import { describe, expect, it } from 'vitest';
import type { ScoredListing } from './listings.js';
import { applyPlan, planSchema } from './search-agent.js';

function listing(overrides: Partial<ScoredListing>): ScoredListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: '1',
    key: 'redfin:1',
    title: 'Apartment',
    description: 'A place to live',
    price: 4000,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    address: '1 Main St',
    city: 'San Francisco',
    neighborhood: 'Mission',
    lat: 37.76,
    lng: -122.42,
    url: 'https://example.com/1',
    imageUrl: null,
    imageUrls: [],
    photoCount: 3,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    ...overrides,
  };
}

const plan = (overrides: Partial<ReturnType<typeof planSchema.parse>> = {}) =>
  planSchema.parse(overrides);

describe('applyPlan', () => {
  it('keeps only listings inside every constraint the plan states', () => {
    const listings = [
      listing({ key: 'a', price: 3000, bedrooms: 2, neighborhood: 'Mission' }),
      listing({ key: 'b', price: 6000, bedrooms: 2, neighborhood: 'Mission' }),
      listing({ key: 'c', price: 3000, bedrooms: 1, neighborhood: 'Mission' }),
      listing({ key: 'd', price: 3000, bedrooms: 2, neighborhood: 'SoMa' }),
    ];

    const kept = applyPlan(
      listings,
      plan({ maxRent: 4500, bedrooms: [2], neighborhoods: ['Mission'] }),
    );
    expect(kept.map((item) => item.key)).toEqual(['a']);
  });

  it('matches neighborhoods regardless of the case Claude wrote them in', () => {
    const listings = [listing({ key: 'a', neighborhood: 'SoMa' })];
    expect(applyPlan(listings, plan({ neighborhoods: ['soma'] }))).toHaveLength(1);
  });

  it('drops listings over the scam ceiling', () => {
    const listings = [
      listing({ key: 'safe', scam: { score: 10, band: 'low', reasons: [], checks: [] } }),
      listing({ key: 'risky', scam: { score: 60, band: 'high', reasons: ['wire transfer'], checks: [] } }),
    ];
    expect(applyPlan(listings, plan({ maxScamScore: 25 })).map((item) => item.key)).toEqual(['safe']);
  });

  it('ranks by distance below the median for the same bedroom count, not raw price', () => {
    const listings = [
      listing({ key: 'cheap-studio', price: 2000, bedrooms: 0 }),
      listing({ key: 'studio', price: 2400, bedrooms: 0 }),
      listing({ key: 'bargain-2br', price: 3000, bedrooms: 2 }),
      listing({ key: '2br', price: 6000, bedrooms: 2 }),
    ];

    const ranked = applyPlan(listings, plan({ sort: 'value' }));
    expect(ranked[0].key).toBe('bargain-2br');
  });

  it('treats keywords as a feature search over the listing text', () => {
    const listings = [
      listing({ key: 'with', description: 'In-unit laundry and parking' }),
      listing({ key: 'without', description: 'Cozy studio' }),
    ];
    expect(applyPlan(listings, plan({ keywords: ['laundry'] })).map((i) => i.key)).toEqual(['with']);
  });

  it('fills in an unconstrained plan when Claude omits keys', () => {
    expect(plan()).toEqual({
      minRent: 0,
      maxRent: 100_000,
      bedrooms: [],
      neighborhoods: [],
      maxScamScore: 100,
      keywords: [],
      sort: 'value',
    });
  });

  it('rejects a plan with out-of-range numbers rather than trusting it', () => {
    expect(() => planSchema.parse({ maxScamScore: 900 })).toThrow();
  });
});
