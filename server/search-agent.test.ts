import { describe, expect, it } from 'vitest';
import type { AreaFacts, RailKind, SafetyGrade } from './area.js';
import type { ScoredListing } from './listings.js';
import { applyPlan, matchWithFallback, planSchema } from './search-agent.js';

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
    area: null,
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

  it('keeps listings a keyword cannot be checked against, since the source published no text', () => {
    const listings = [
      listing({ key: 'text', description: 'Cats and dogs welcome' }),
      listing({ key: 'other-text', description: 'Cozy studio' }),
      listing({ key: 'no-text', description: '', detail: 'summary' }),
    ];
    expect(applyPlan(listings, plan({ keywords: ['dogs'] })).map((i) => i.key)).toEqual([
      'text',
      'no-text',
    ]);
  });

  it('ranks listings that mention a keyword ahead of ones with no text to check', () => {
    const listings = [
      listing({ key: 'no-text', description: '', price: 2000 }),
      listing({ key: 'text', description: 'Dogs welcome', price: 5000 }),
    ];
    expect(applyPlan(listings, plan({ keywords: ['dogs'], sort: 'price-asc' })).map((i) => i.key)).toEqual([
      'text',
      'no-text',
    ]);
  });

  it('filters by walk to a kind of rail stop, not just the nearest stop', () => {
    const stop = (kind: RailKind, walkMinutes: number | null) => ({ name: 's', kind, meters: 0, walkMinutes });
    const area = (rail: AreaFacts['rail'], transit = stop('Muni rail', 2)): AreaFacts => ({
      transit,
      rail,
      incidents: null,
      safety: null,
      parking: null,
    });
    const listings = [
      listing({ key: 'caltrain-close', area: area({ 'Muni rail': stop('Muni rail', 2), Caltrain: stop('Caltrain', 9) }) }),
      listing({ key: 'caltrain-far', area: area({ 'Muni rail': stop('Muni rail', 2), Caltrain: stop('Caltrain', 25) }) }),
      listing({ key: 'caltrain-unwalkable', area: area({ Caltrain: stop('Caltrain', null) }) }),
      // Scored before per-kind stops existed: only its nearest stop is known.
      listing({ key: 'legacy-caltrain', area: area(undefined, stop('Caltrain', 5)) }),
      listing({ key: 'legacy-muni', area: area(undefined, stop('Muni rail', 3)) }),
      listing({ key: 'no-coords', area: null }),
    ];
    const keys = (kind: 'Caltrain' | 'any') =>
      applyPlan(listings, plan({ nearTrain: { kind, maxWalkMinutes: 15 } }))
        .map((i) => i.key)
        .sort();
    expect(keys('Caltrain')).toEqual(['caltrain-close', 'legacy-caltrain']);
    expect(keys('any')).toEqual(['caltrain-close', 'caltrain-far', 'caltrain-unwalkable', 'legacy-caltrain', 'legacy-muni']);
  });

  it('keeps only grades at least as quiet as the minimum, and drops unknown ones', () => {
    const graded = (key: string, grade: SafetyGrade | null) =>
      listing({
        key,
        area: grade
          ? {
              transit: null,
              incidents: null,
              parking: null,
              safety: {
                grade,
                violentCount: 0,
                residents: 0,
                ratePer100k: 0,
                cityRatePer100k: 0,
                radiusMeters: 0,
                quieterThanPercent: 0,
              },
            }
          : null,
      });
    const listings = [graded('a', 'A'), graded('b', 'B'), graded('c', 'C'), graded('unknown', null)];
    expect(applyPlan(listings, plan({ minSafetyGrade: 'B' })).map((i) => i.key)).toEqual(['a', 'b']);
  });

  it('reads a per-person budget as rent split by bedroom, not the whole unit', () => {
    const listings = [
      listing({ key: 'four-share', price: 9000, bedrooms: 4 }),
      listing({ key: 'pricey-four', price: 11_000, bedrooms: 4 }),
      listing({ key: 'studio', price: 2400, bedrooms: 0 }),
    ];

    const kept = applyPlan(listings, plan({ maxRentPerBedroom: 2500 }));
    expect(kept.map((item) => item.key).sort()).toEqual(['four-share', 'studio']);
  });

  it('reads a bathroom each as one bath per bedroom, keeping unknown bath counts', () => {
    const listings = [
      listing({ key: 'ensuite', bedrooms: 3, bathrooms: 3 }),
      listing({ key: 'shared', bedrooms: 3, bathrooms: 1 }),
      listing({ key: 'unknown', bedrooms: 3, bathrooms: null }),
    ];

    const kept = applyPlan(listings, plan({ bathsPerBedroom: 1 }));
    expect(kept.map((item) => item.key).sort()).toEqual(['ensuite', 'unknown']);
  });

  it('sorts a group budget by the share each person pays, not the whole rent', () => {
    const listings = [
      listing({ key: 'studio', price: 2400, bedrooms: 0 }),
      listing({ key: 'four-share', price: 6800, bedrooms: 4 }),
    ];
    expect(applyPlan(listings, plan({ sort: 'per-bedroom-asc' })).map((i) => i.key)).toEqual([
      'four-share',
      'studio',
    ]);
  });

  it('fills in an unconstrained plan when Claude omits keys', () => {
    expect(plan()).toEqual({
      minRent: 0,
      maxRent: 100_000,
      maxRentPerBedroom: 0,
      bedrooms: [],
      minBathrooms: 0,
      bathsPerBedroom: 0,
      neighborhoods: [],
      maxScamScore: 100,
      keywords: [],
      nearTrain: null,
      minSafetyGrade: null,
      sort: 'value',
    });
  });

  it('rejects a plan with out-of-range numbers rather than trusting it', () => {
    expect(() => planSchema.parse({ maxScamScore: 900 })).toThrow();
  });
});

describe('matchWithFallback', () => {
  it('answers with something and names what it ignored instead of matching nothing', () => {
    const listings = [listing({ key: 'a', price: 8000, bedrooms: 4, bathrooms: 4 })];

    const { matches, relaxed } = matchWithFallback(
      listings,
      plan({ maxRentPerBedroom: 2500, bathsPerBedroom: 1, keywords: ['pets'] }),
    );

    expect(matches.map((item) => item.key)).toEqual(['a']);
    expect(relaxed).toEqual(['"pets" in the listing text']);
  });

  it('drops the bathroom requirement too when the keyword alone was not the problem', () => {
    const listings = [listing({ key: 'a', price: 8000, bedrooms: 4, bathrooms: 1, description: '' })];

    const { matches, relaxed } = matchWithFallback(
      listings,
      plan({ maxRentPerBedroom: 2500, bathsPerBedroom: 1, keywords: ['pets'] }),
    );

    expect(matches.map((item) => item.key)).toEqual(['a']);
    expect(relaxed).toEqual(['the bathroom requirement']);
  });

  it('relaxes nothing when the plan already matches', () => {
    const listings = [listing({ key: 'a', price: 3000, bedrooms: 2, bathrooms: 2 })];
    expect(matchWithFallback(listings, plan({ maxRent: 4000 })).relaxed).toEqual([]);
  });

  it('leaves the budget alone when even a fully relaxed filter finds nothing', () => {
    const listings = [listing({ key: 'a', price: 9000, bedrooms: 1 })];
    const { matches, relaxed } = matchWithFallback(listings, plan({ maxRent: 2000 }));
    expect(matches).toEqual([]);
    expect(relaxed).toEqual([]);
  });
});
