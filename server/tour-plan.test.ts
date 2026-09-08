import { describe, expect, it } from 'vitest';
import type { ScoredListing } from './listings.js';
import { driveMatrix, improvePath, type Point } from './routing.js';
import { buildPlan, type Candidates, type PlanRequest } from './tour-plan.js';

function listing(key: string, price: number, lat: number, lng: number, neighborhood = 'Mission'): ScoredListing {
  return {
    key,
    id: key,
    sourceId: 'redfin',
    sourceName: 'Redfin',
    title: key,
    address: `${key} St`,
    price,
    bedrooms: 3,
    bathrooms: 2,
    sqft: null,
    lat,
    lng,
    url: `https://example.com/${key}`,
    imageUrl: null,
    imageUrls: [],
    description: '',
    postedAt: null,
    contactPhone: null,
    contactEmail: null,
    gradientFrom: '#000',
    gradientTo: '#fff',
    neighborhood,
    scam: { score: 5, level: 'low', signals: [], passed: [] },
    area: null,
  } as unknown as ScoredListing;
}

const DAY = Date.UTC(2026, 8, 13, 17, 0); // 10:00 PT
const plan: PlanRequest = {
  startsAt: DAY,
  endsAt: DAY + 3 * 60 * 60_000,
  tourMinutes: 30,
  groupSize: 3,
  maxPerPerson: 2000,
  neighborhoods: [],
  maxScamScore: 25,
  leavingFrom: null,
};

/** OSRM is not reachable from tests; the straight-line estimate stands in. */
const offline = (points: Point[]) => driveMatrix(points, () => Promise.reject(new Error('offline')));
const candidates = (listings: ScoredListing[], start: Candidates['start'] = null): Candidates => ({ listings, start });

describe('tour day planner', () => {
  it('packs the day with nearby stops, drive time between them, and quarter-hour ask times', async () => {
    const result = await buildPlan(
      candidates([
        listing('a', 4500, 37.76, -122.42),
        listing('b', 4600, 37.761, -122.421),
        listing('c', 4700, 37.762, -122.422),
        listing('far', 4400, 37.72, -122.5),
      ]),
      { ...plan, endsAt: DAY + 4 * 60 * 60_000 },
      offline,
    );

    expect(result.stops.length).toBe(4);
    expect(result.travelSource).toBe('estimate');
    for (let i = 1; i < result.stops.length; i += 1) {
      const previous = result.stops[i - 1];
      const gap = (result.stops[i].startsAt - (previous.startsAt + previous.minutes * 60_000)) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(result.stops[i].travelMinutes ?? 0);
      expect(result.stops[i].startsAt % (15 * 60_000)).toBe(0);
    }
    expect(result.stops.at(-1)!.startsAt + 30 * 60_000).toBeLessThanOrEqual(DAY + 4 * 60 * 60_000);
    expect(result.routeUrl).toContain('google.com/maps/dir');
    expect(result.stops[0].perPerson).toBe(Math.round(result.stops[0].listing.price / 3));
  });

  it('sweeps across town in one direction instead of zig-zagging', async () => {
    // Four stops on a line west→east; a price order that would zig-zag.
    const result = await buildPlan(
      candidates([
        listing('east', 4000, 37.76, -122.40),
        listing('west', 4100, 37.76, -122.48),
        listing('mid-east', 4200, 37.76, -122.42),
        listing('mid-west', 4300, 37.76, -122.46),
      ]),
      { ...plan, endsAt: DAY + 6 * 60 * 60_000 },
      offline,
    );
    const lngs = result.stops.map((stop) => stop.listing.lng as number);
    const sorted = [...lngs].sort((a, b) => a - b);
    expect(lngs.join() === sorted.join() || lngs.join() === sorted.reverse().join()).toBe(true);
  });

  it('starts from the neighborhood the group is leaving from and counts that first leg', async () => {
    const result = await buildPlan(
      candidates(
        [listing('east', 4000, 37.76, -122.40), listing('west', 4100, 37.76, -122.48)],
        { lat: 37.76, lng: -122.5, label: 'Outer Sunset' },
      ),
      plan,
      offline,
    );
    expect(result.stops[0].listing.key).toBe('west');
    expect(result.stops[0].travelKm).toBeGreaterThan(0);
    expect(result.stops[0].startsAt).toBeGreaterThan(plan.startsAt);
    expect(result.start?.label).toBe('Outer Sunset');
    expect(result.routeUrl).toContain('origin=37.76%2C-122.5');
  });

  it('stops when the day runs out and counts what did not fit', async () => {
    const pool = Array.from({ length: 12 }, (_, i) => listing(`l${i}`, 4000 + i * 100, 37.7 + i * 0.02, -122.4));
    const result = await buildPlan(candidates(pool), { ...plan, endsAt: DAY + 60 * 60_000 }, offline);
    expect(result.stops.length).toBeLessThan(12);
    expect(result.leftOver).toBe(12 - result.stops.length);
  });

  it('returns an empty plan with no candidates', async () => {
    const result = await buildPlan(candidates([]), plan, offline);
    expect(result.stops).toEqual([]);
    expect(result.routeUrl).toBeNull();
    expect(result.averagePerPerson).toBeNull();
  });
});

describe('routing', () => {
  it('reads OSRM table durations and distances with traffic and parking padding', async () => {
    const fetcher = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'Ok',
            durations: [[0, 600], [600, 0]],
            distances: [[0, 5000], [5000, 0]],
          }),
        ),
      )) as typeof fetch;
    const matrix = await driveMatrix([{ lat: 37.76, lng: -122.42 }, { lat: 37.78, lng: -122.45 }], fetcher);
    expect(matrix.source).toBe('osrm');
    expect(matrix.legs[0][1]).toEqual({ km: 5, minutes: Math.ceil(10 * 1.15) + 5 });
    expect(matrix.legs[0][0]).toEqual({ km: 0, minutes: 0 });
  });

  it('untangles a crossed path with 2-opt and keeps a fixed start in place', () => {
    const legs = [
      [0, 1, 10, 10],
      [1, 0, 10, 10],
      [10, 10, 0, 1],
      [10, 10, 1, 0],
    ].map((row) => row.map((minutes) => ({ km: minutes, minutes })));
    expect(improvePath([0, 2, 1, 3], legs, true)).toEqual([0, 1, 2, 3]);
  });
});
