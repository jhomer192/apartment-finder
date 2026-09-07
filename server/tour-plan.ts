import { z } from 'zod';
import { getListings, type ScoredListing } from './listings.js';
import { listSaved } from './shortlist.js';
import { kmBetween, travelMinutes } from './tours.js';

/**
 * Packs one day with as many tours as fit, chosen from the cheapest listings
 * that suit the group and the neighborhoods they want. Legs are straight-line
 * distance at city speed, so the plan is a floor on the real driving and the
 * route is handed to Google Maps rather than promised.
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
  })
  .refine((plan) => plan.endsAt > plan.startsAt, { message: 'The day must end after it starts.' });

export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface PlannedStop {
  listing: ScoredListing;
  startsAt: number;
  minutes: number;
  /** From the previous stop; null for the first. */
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
  averagePerPerson: number | null;
  routeUrl: string | null;
}

/** Cheapest listings considered; more than this and the day is full anyway. */
const CANDIDATE_POOL = 40;
/** Different first stops tried; each seed is one greedy pass. */
const SEEDS = 12;
const MAX_WAYPOINTS = 10;

function routeUrl(stops: ScoredListing[]): string | null {
  const points = stops
    .slice(0, MAX_WAYPOINTS)
    .map((listing) => listing.address || `${listing.lat},${listing.lng}`)
    .filter((point) => point && point !== 'null,null');
  if (points.length < 2) return null;
  const params = new URLSearchParams({ api: '1', origin: points[0], destination: points[points.length - 1] });
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Nearest-neighbour packing from one starting listing: keep taking the closest
 * unvisited candidate while it still fits before the day ends. Distance is
 * monotone, so once the nearest does not fit nothing else will either.
 */
function pack(seed: ScoredListing, pool: ScoredListing[], plan: PlanRequest): PlannedStop[] {
  const saved = new Set(listSaved().map((entry) => entry.key));
  const stops: PlannedStop[] = [
    {
      listing: seed,
      startsAt: plan.startsAt,
      minutes: plan.tourMinutes,
      travelKm: null,
      travelMinutes: null,
      perPerson: Math.round(seed.price / plan.groupSize),
      saved: saved.has(seed.key),
    },
  ];
  const remaining = pool.filter((listing) => listing.key !== seed.key);
  let clock = plan.startsAt + plan.tourMinutes * 60_000;
  let at = seed;

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestKm = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const km = kmBetween(at, remaining[i]) ?? Infinity;
      const cheaperTie = bestIndex >= 0 && km === bestKm && remaining[i].price < remaining[bestIndex].price;
      if (km < bestKm || cheaperTie) {
        bestKm = km;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || !Number.isFinite(bestKm)) break;

    const drive = travelMinutes(bestKm);
    const startsAt = clock + drive * 60_000;
    if (startsAt + plan.tourMinutes * 60_000 > plan.endsAt) break;

    const [next] = remaining.splice(bestIndex, 1);
    stops.push({
      listing: next,
      startsAt,
      minutes: plan.tourMinutes,
      travelKm: bestKm,
      travelMinutes: drive,
      perPerson: Math.round(next.price / plan.groupSize),
      saved: saved.has(next.key),
    });
    clock = startsAt + plan.tourMinutes * 60_000;
    at = next;
  }
  return stops;
}

function score(stops: PlannedStop[]): [number, number, number] {
  const savedCount = stops.filter((stop) => stop.saved).length;
  const rent = stops.reduce((sum, stop) => sum + stop.listing.price, 0) / Math.max(1, stops.length);
  return [stops.length, savedCount, -rent];
}

function better(a: PlannedStop[], b: PlannedStop[]): boolean {
  const [ac, as, ar] = score(a);
  const [bc, bs, br] = score(b);
  if (ac !== bc) return ac > bc;
  if (as !== bs) return as > bs;
  return ar > br;
}

export async function candidateListings(plan: PlanRequest): Promise<ScoredListing[]> {
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
  return listings
    .filter((listing) => listing.lat !== null && listing.lng !== null)
    .filter((listing) => listing.scam.score <= plan.maxScamScore)
    .filter((listing) => wanted.size === 0 || wanted.has(listing.neighborhood.toLowerCase()))
    .sort((a, b) => a.price - b.price);
}

/**
 * Saved listings that qualify always make the pool; the rest is filled with the
 * cheapest matches so the day is spent on places the group can afford.
 */
export function buildPlan(candidates: ScoredListing[], plan: PlanRequest): TourPlan {
  const saved = new Set(listSaved().map((entry) => entry.key));
  const pool = [
    ...candidates.filter((listing) => saved.has(listing.key)),
    ...candidates.filter((listing) => !saved.has(listing.key)),
  ].slice(0, CANDIDATE_POOL);

  let best: PlannedStop[] = [];
  for (const seed of pool.slice(0, SEEDS)) {
    const attempt = pack(seed, pool, plan);
    if (better(attempt, best)) best = attempt;
  }

  const totalKm = Math.round(best.reduce((sum, stop) => sum + (stop.travelKm ?? 0), 0) * 100) / 100;
  const averagePerPerson =
    best.length === 0 ? null : Math.round(best.reduce((sum, stop) => sum + stop.perPerson, 0) / best.length);

  return {
    stops: best,
    leftOver: Math.max(0, candidates.length - best.length),
    candidates: candidates.length,
    totalKm,
    averagePerPerson,
    routeUrl: routeUrl(best.map((stop) => stop.listing)),
  };
}

export async function planTourDay(plan: PlanRequest): Promise<TourPlan> {
  return buildPlan(await candidateListings(plan), plan);
}
