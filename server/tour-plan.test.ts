import { describe, expect, it } from 'vitest';
import type { ScoredListing } from './listings.js';
import { buildPlan, type PlanRequest } from './tour-plan.js';

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
};

describe('tour day planner', () => {
  it('packs the day with nearby stops and leaves drive time between them', () => {
    const candidates = [
      listing('a', 4500, 37.76, -122.42),
      listing('b', 4600, 37.761, -122.421),
      listing('c', 4700, 37.762, -122.422),
      listing('far', 4400, 37.72, -122.5),
    ];
    const result = buildPlan(candidates, plan);

    expect(result.stops.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < result.stops.length; i += 1) {
      const previous = result.stops[i - 1];
      const gap = (result.stops[i].startsAt - (previous.startsAt + previous.minutes * 60_000)) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(result.stops[i].travelMinutes ?? 0);
    }
    expect(result.stops.at(-1)!.startsAt + 30 * 60_000).toBeLessThanOrEqual(plan.endsAt);
    expect(result.routeUrl).toContain('google.com/maps/dir');
    expect(result.stops[0].perPerson).toBe(Math.round(result.stops[0].listing.price / 3));
  });

  it('stops when the day runs out and counts what did not fit', () => {
    const candidates = Array.from({ length: 12 }, (_, i) => listing(`l${i}`, 4000 + i * 100, 37.7 + i * 0.02, -122.4));
    const result = buildPlan(candidates, { ...plan, endsAt: DAY + 60 * 60_000 });
    expect(result.stops.length).toBeLessThan(12);
    expect(result.leftOver).toBe(12 - result.stops.length);
  });

  it('returns an empty plan with no candidates', () => {
    const result = buildPlan([], plan);
    expect(result.stops).toEqual([]);
    expect(result.routeUrl).toBeNull();
    expect(result.averagePerPerson).toBeNull();
  });
});
