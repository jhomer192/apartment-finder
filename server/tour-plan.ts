import { z } from 'zod';
import { getListings, type ScoredListing } from './listings.js';
import { driveMatrix, improvePath, pathMinutes, type DriveMatrix, type MatrixSource, type Point } from './routing.js';
import { listSaved } from './shortlist.js';

/**
 * Packs one day with as many tours as fit, chosen from the cheapest listings
 * that suit the group and the neighborhoods they want, ordered as one sweep
 * across the city rather than a zig-zag. Legs come from OSRM road routing
 * when it answers, otherwise a straight-line estimate, and the plan says which.
 */
export const planRequestSchema = z
  .object({
    startsAt: z.number().int().positive(),
    endsAt: z.number().int().positive(),
    tourMinutes: z.number().int().min(10).max(120).default(30),
    /** People moving in together; each tour needs at least this many bedrooms. */
    groupSize: z.number().int().min(1).max(6),
    /** Monthly rent per person the group is willing to pay; null for no cap. */
    maxPerPerson: z.number().int().positive().max(20_000).nullable().default(null),
    /** Preferred neighborhoods; empty means anywhere the house rules allow. */
    neighborhoods: z.array(z.string().min(1).max(60)).max(60).default([]),
    maxScamScore: z.number().int().min(0).max(100).default(25),
    /** Neighborhood the group sets out from, so the sweep starts on their side of town. */
    leavingFrom: z.string().min(1).max(60).nullable().default(null),
  })
  .refine((plan) => plan.endsAt > plan.startsAt, { message: 'The day must end after it starts.' });

export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface PlannedStop {
  listing: ScoredListing;
  /** The time to ask the lister for; rounded to a quarter hour. */
  startsAt: number;
  minutes: number;
  /** From the previous stop (or the leaving-from point); null when the day starts here. */
  travelKm: number | null;
  travelMinutes: number | null;
  perPerson: number;
  saved: boolean;
}

export interface TourPlan {
  stops: PlannedStop[];
  /** Listings that qualified but did not fit in the day. */
  leftOver: number;
  candidates: number;
  totalKm: number;
  totalDriveMinutes: number;
  averagePerPerson: number | null;
  routeUrl: string | null;
  /** Where the drive figures came from. */
  travelSource: MatrixSource;
  /** Where the sweep begins, when the group named a neighborhood. */
  start: (Point & { label: string }) | null;
}

/** Cheapest listings considered; more than this and the day is full anyway. */
const CANDIDATE_POOL = 40;
const MAX_WAYPOINTS = 10;
const QUARTER_MS = 15 * 60_000;

function routeUrl(start: Point | null, stops: ScoredListing[]): string | null {
  const points = [
    ...(start ? [`${start.lat},${start.lng}`] : []),
    ...stops.map((listing) => listing.address || `${listing.lat},${listing.lng}`),
  ]
    .filter((point) => point && point !== 'null,null')
    .slice(0, MAX_WAYPOINTS);
  if (points.length < 2) return null;
  const params = new URLSearchParams({ api: '1', origin: points[0], destination: points[points.length - 1] });
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function roundUpToQuarter(ms: number): number {
  return Math.ceil(ms / QUARTER_MS) * QUARTER_MS;
}

interface Timed {
  stops: PlannedStop[];
  endsAt: number;
}

/**
 * Walks the path in order, asking for each tour at the next quarter hour after
 * the drive from the previous stop. `path` holds point indices; index 0 is the
 * leaving-from point when there is one.
 */
function schedule(path: number[], points: ScoredListing[], matrix: DriveMatrix, plan: PlanRequest, hasStart: boolean, saved: Set<string>): Timed {
  const stops: PlannedStop[] = [];
  let clock = plan.startsAt;
  let previous: number | null = hasStart ? 0 : null;
  for (const index of path) {
    if (hasStart && index === 0) continue;
    const listing = points[index - (hasStart ? 1 : 0)];
    const leg = previous === null ? null : matrix.legs[previous][index];
    const startsAt = leg ? roundUpToQuarter(clock + leg.minutes * 60_000) : clock;
    stops.push({
      listing,
      startsAt,
      minutes: plan.tourMinutes,
      travelKm: leg ? leg.km : null,
      travelMinutes: leg ? leg.minutes : null,
      perPerson: Math.round(listing.price / plan.groupSize),
      saved: saved.has(listing.key),
    });
    clock = startsAt + plan.tourMinutes * 60_000;
    previous = index;
  }
  return { stops, endsAt: clock };
}

/**
 * Where the best position for a new stop is: the one that adds the least
 * driving, followed by a 2-opt pass so the whole path stays a single sweep.
 */
function insert(path: number[], index: number, matrix: DriveMatrix, hasStart: boolean): number[] {
  const first = hasStart ? 1 : 0;
  let best: number[] | null = null;
  let bestMinutes = Infinity;
  for (let at = first; at <= path.length; at += 1) {
    const candidate = [...path.slice(0, at), index, ...path.slice(at)];
    const minutes = pathMinutes(candidate, matrix.legs);
    if (minutes < bestMinutes) {
      bestMinutes = minutes;
      best = candidate;
    }
  }
  return improvePath(best ?? [index], matrix.legs, hasStart);
}

export interface Candidates {
  listings: ScoredListing[];
  start: (Point & { label: string }) | null;
}

export async function candidateListings(plan: PlanRequest): Promise<Candidates> {
  const maxRent = plan.maxPerPerson === null ? 100_000 : plan.maxPerPerson * plan.groupSize;
  const { listings } = await getListings({
    minRent: 0,
    maxRent,
    minBedrooms: plan.groupSize,
    maxBedrooms: null,
    limit: 5000,
    dedupe: true,
    includeHidden: false,
  });
  const wanted = new Set(plan.neighborhoods.map((name) => name.toLowerCase()));
  const located = listings.filter((listing) => listing.lat !== null && listing.lng !== null);
  return {
    listings: located
      .filter((listing) => listing.scam.score <= plan.maxScamScore)
      .filter((listing) => wanted.size === 0 || wanted.has(listing.neighborhood.toLowerCase()))
      .sort((a, b) => a.price - b.price),
    start: plan.leavingFrom ? await neighborhoodCentre(plan.leavingFrom, located) : null,
  };
}

/** The middle of a neighborhood, from every listing we know there; enough to start a route. */
async function neighborhoodCentre(name: string, known: ScoredListing[]): Promise<(Point & { label: string }) | null> {
  let pool = known.filter((listing) => listing.neighborhood.toLowerCase() === name.toLowerCase());
  if (pool.length === 0) {
    const { listings } = await getListings({ minRent: 0, maxRent: 100_000, minBedrooms: null, maxBedrooms: null, limit: 5000, dedupe: true, includeHidden: true });
    pool = listings.filter((listing) => listing.lat !== null && listing.lng !== null && listing.neighborhood.toLowerCase() === name.toLowerCase());
  }
  if (pool.length === 0) return null;
  const lat = pool.reduce((sum, listing) => sum + (listing.lat ?? 0), 0) / pool.length;
  const lng = pool.reduce((sum, listing) => sum + (listing.lng ?? 0), 0) / pool.length;
  return { lat, lng, label: pool[0].neighborhood };
}

/**
 * Saved listings that qualify always go in first, then the cheapest matches.
 * Each is slotted where it adds the least driving; anything that would push the
 * last tour past the finish time is left over. A second pass retries the
 * leftovers against the improved route, since a later insert can shorten it.
 */
export async function buildPlan(candidates: Candidates, plan: PlanRequest, matrixFor: typeof driveMatrix = driveMatrix): Promise<TourPlan> {
  const saved = new Set(listSaved().map((entry) => entry.key));
  const pool = [
    ...candidates.listings.filter((listing) => saved.has(listing.key)),
    ...candidates.listings.filter((listing) => !saved.has(listing.key)),
  ].slice(0, CANDIDATE_POOL);
  const hasStart = candidates.start !== null;
  const points: Point[] = [
    ...(candidates.start ? [candidates.start] : []),
    ...pool.map((listing) => ({ lat: listing.lat as number, lng: listing.lng as number })),
  ];
  const matrix = await matrixFor(points);

  let path: number[] = hasStart ? [0] : [];
  const fits = (attempt: number[]) => schedule(attempt, pool, matrix, plan, hasStart, saved).endsAt <= plan.endsAt;
  let leftOver = pool.map((_, i) => i + (hasStart ? 1 : 0));
  for (let pass = 0; pass < 2 && leftOver.length > 0; pass += 1) {
    const still: number[] = [];
    for (const index of leftOver) {
      const attempt = insert(path, index, matrix, hasStart);
      if (fits(attempt)) path = attempt;
      else still.push(index);
    }
    leftOver = still;
  }

  const { stops } = schedule(path, pool, matrix, plan, hasStart, saved);
  const totalKm = Math.round(stops.reduce((sum, stop) => sum + (stop.travelKm ?? 0), 0) * 100) / 100;
  const totalDriveMinutes = stops.reduce((sum, stop) => sum + (stop.travelMinutes ?? 0), 0);
  const averagePerPerson =
    stops.length === 0 ? null : Math.round(stops.reduce((sum, stop) => sum + stop.perPerson, 0) / stops.length);

  return {
    stops,
    leftOver: Math.max(0, candidates.listings.length - stops.length),
    candidates: candidates.listings.length,
    totalKm,
    totalDriveMinutes,
    averagePerPerson,
    routeUrl: routeUrl(candidates.start, stops.map((stop) => stop.listing)),
    travelSource: matrix.source,
    start: candidates.start,
  };
}

export async function planTourDay(plan: PlanRequest): Promise<TourPlan> {
  return buildPlan(await candidateListings(plan), plan);
}
