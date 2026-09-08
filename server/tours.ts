import { z } from 'zod';
import { db } from './db.js';
import { getSaved, listSaved } from './shortlist.js';
import type { ScoredListing } from './listings.js';
import { driveMatrix, improvePath, type DriveMatrix, type Leg, type MatrixSource } from './routing.js';

/**
 * Tour times the whole group can see, so two people do not book the same
 * Saturday afternoon twice and nobody drives Sunset → Mission → Sunset.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS tours (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_key TEXT NOT NULL REFERENCES saved_listings(listing_key) ON DELETE CASCADE,
    starts_at   INTEGER NOT NULL,
    minutes     INTEGER NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    created_by  TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tours_listing ON tours(listing_key);
`);

export const tourSchema = z.object({
  listingKey: z.string().min(1).max(300),
  startsAt: z.number().int().positive(),
  minutes: z.number().int().min(5).max(240).default(30),
  note: z.string().trim().max(300).default(''),
});

export type TourInput = z.infer<typeof tourSchema>;

export interface Tour {
  id: number;
  listingKey: string;
  startsAt: number;
  minutes: number;
  note: string;
  createdBy: string;
  listing: ScoredListing;
}

/** How a tour sits against the one booked before it that day. */
export type TourWarning = 'overlap' | 'tight';

export interface PlannedTour extends Tour {
  /** Straight-line km from the previous tour that day; null for the first. */
  travelKm: number | null;
  travelMinutes: number | null;
  warning: TourWarning | null;
}

export interface TourDay {
  /** Calendar day in San Francisco, as YYYY-MM-DD. */
  date: string;
  tours: PlannedTour[];
  /** Listing keys in the order that travels least, when it beats the booked one. */
  suggestedOrder: string[];
  bookedKm: number;
  suggestedKm: number;
  /** Google Maps with the day's stops as waypoints, in the suggested order. */
  routeUrl: string | null;
  /** Whether legs are road-routed or straight-line guesses. */
  travelSource: MatrixSource;
}

interface TourRow {
  id: number;
  listing_key: string;
  starts_at: number;
  minutes: number;
  note: string;
  created_by: string;
}

/** City driving with parking and a walk to the door, deliberately unhurried. */
const CITY_KMH = 18;
const PARKING_MINUTES = 5;
/** Beyond this, every ordering is tried; above it the booked order stands. */
const MAX_OPTIMIZED_STOPS = 7;

export function kmBetween(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/** Straight-line distance, so this is a floor on the real trip, never a promise. */
export function travelMinutes(km: number): number {
  return Math.ceil((km / CITY_KMH) * 60) + PARKING_MINUTES;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function sfDay(startsAt: number): string {
  return DAY_FORMAT.format(new Date(startsAt));
}

/** Leg between two of the day's stops: road-routed when a matrix is at hand, else straight-line. */
function legBetween(stops: Tour[], matrix: DriveMatrix | null, from: number, to: number): Leg | null {
  if (matrix) return matrix.legs[from][to];
  const km = kmBetween(stops[from].listing, stops[to].listing);
  return km === null ? null : { km, minutes: travelMinutes(km) };
}

function pathKm(stops: Tour[], matrix: DriveMatrix | null, order: number[]): number {
  let total = 0;
  for (let i = 1; i < order.length; i += 1) {
    total += legBetween(stops, matrix, order[i - 1], order[i])?.km ?? 0;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Shortest walk of the day's stops. Under eight tours every order is measured,
 * which is exact; past that 2-opt improves the booked order instead.
 */
function shortestOrder(stops: Tour[], matrix: DriveMatrix | null): number[] {
  const booked = stops.map((_, i) => i);
  if (stops.length < 3) return booked;
  if (stops.some((stop) => stop.listing.lat === null || stop.listing.lng === null)) return booked;
  const cost = (order: number[]) => {
    let total = 0;
    for (let i = 1; i < order.length; i += 1) total += legBetween(stops, matrix, order[i - 1], order[i])?.minutes ?? 0;
    return total;
  };
  if (stops.length > MAX_OPTIMIZED_STOPS) {
    const legs = stops.map((_, i) => stops.map((__, j) => legBetween(stops, matrix, i, j) ?? { km: 0, minutes: 0 }));
    return improvePath(booked, legs, false);
  }

  let best = booked;
  let bestCost = cost(booked);
  const permute = (order: number[], rest: number[]) => {
    if (rest.length === 0) {
      const total = cost(order);
      if (total < bestCost) {
        best = order;
        bestCost = total;
      }
      return;
    }
    for (let i = 0; i < rest.length; i += 1) {
      permute([...order, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]);
    }
  };
  permute([], booked);
  return best;
}

function routeUrl(stops: Tour[]): string | null {
  const points = stops
    .map((stop) => stop.listing.address || `${stop.listing.lat},${stop.listing.lng}`)
    .filter((point) => point && point !== 'null,null');
  if (points.length < 2) return null;

  const params = new URLSearchParams({
    api: '1',
    origin: points[0],
    destination: points[points.length - 1],
  });
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function groupByDay(tours: Tour[]): [string, Tour[]][] {
  const byDay = new Map<string, Tour[]>();
  for (const tour of [...tours].sort((a, b) => a.startsAt - b.startsAt)) {
    const day = sfDay(tour.startsAt);
    byDay.set(day, [...(byDay.get(day) ?? []), tour]);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function planDay(date: string, booked: Tour[], matrix: DriveMatrix | null): TourDay {
  const planned: PlannedTour[] = booked.map((tour, index) => {
    if (index === 0) return { ...tour, travelKm: null, travelMinutes: null, warning: null };

    const previous = booked[index - 1];
    const leg = legBetween(booked, matrix, index - 1, index);
    const gapMinutes = (tour.startsAt - (previous.startsAt + previous.minutes * 60_000)) / 60_000;

    const warning: TourWarning | null =
      gapMinutes < 0 ? 'overlap' : leg !== null && gapMinutes < leg.minutes ? 'tight' : null;

    return { ...tour, travelKm: leg?.km ?? null, travelMinutes: leg?.minutes ?? null, warning };
  });

  const suggested = shortestOrder(booked, matrix);
  return {
    date,
    tours: planned,
    suggestedOrder: suggested.map((i) => booked[i].listingKey),
    bookedKm: pathKm(booked, matrix, booked.map((_, i) => i)),
    suggestedKm: pathKm(booked, matrix, suggested),
    routeUrl: routeUrl(suggested.map((i) => booked[i])),
    travelSource: matrix?.source ?? 'estimate',
  };
}

/** Groups by SF calendar day, marks clashes, and works out a shorter order from straight-line legs. */
export function planDays(tours: Tour[]): TourDay[] {
  return groupByDay(tours).map(([date, booked]) => planDay(date, booked, null));
}

/** Same, with road-routed legs for each day that has more than one stop. */
export async function planDaysRouted(tours: Tour[], matrixFor: typeof driveMatrix = driveMatrix): Promise<TourDay[]> {
  return Promise.all(
    groupByDay(tours).map(async ([date, booked]) => {
      const located = booked.every((tour) => tour.listing.lat !== null && tour.listing.lng !== null);
      const matrix =
        booked.length > 1 && located
          ? await matrixFor(booked.map((tour) => ({ lat: tour.listing.lat as number, lng: tour.listing.lng as number })))
          : null;
      return planDay(date, booked, matrix);
    }),
  );
}

function hydrate(rows: TourRow[]): Tour[] {
  const listings = new Map(listSaved().map((entry) => [entry.key, entry.listing]));
  return rows
    .map((row) => {
      const listing = listings.get(row.listing_key);
      if (!listing) return null;
      return {
        id: row.id,
        listingKey: row.listing_key,
        startsAt: row.starts_at,
        minutes: row.minutes,
        note: row.note,
        createdBy: row.created_by,
        listing,
      };
    })
    .filter((tour): tour is Tour => tour !== null);
}

export function listTours(): Tour[] {
  const rows = db
    .prepare('SELECT id, listing_key, starts_at, minutes, note, created_by FROM tours ORDER BY starts_at')
    .all() as TourRow[];
  return hydrate(rows);
}

/** A tour can only be booked on a listing the group actually saved. */
export function bookTour(input: TourInput, email: string, now = Date.now()): Tour | null {
  if (!getSaved(input.listingKey)) return null;

  const id = db
    .prepare(
      `INSERT INTO tours (listing_key, starts_at, minutes, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.listingKey, input.startsAt, input.minutes, input.note, email, now).lastInsertRowid;

  return listTours().find((tour) => tour.id === Number(id)) ?? null;
}

export function cancelTour(id: number): boolean {
  return db.prepare('DELETE FROM tours WHERE id = ?').run(id).changes > 0;
}
