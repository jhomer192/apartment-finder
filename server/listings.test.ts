import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { storeListings } from './inventory.js';
import { fillMissingFacts, findListings, getListings, type ScoredListing } from './listings.js';
import { houseRulesSchema, setHouseRules } from './rules.js';
import type { RawListing } from './sources/types.js';

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: 'abc',
    title: '2 Bedroom in the Mission',
    description: '',
    price: 4200,
    bedrooms: 2,
    bathrooms: null,
    sqft: null,
    address: '123 Valencia St',
    city: 'San Francisco',
    lat: 37.76,
    lng: -122.42,
    url: 'https://example.com/abc',
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    ...overrides,
  };
}

function stored(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    ...listing(),
    key: 'redfin:abc',
    neighborhood: 'Mission District',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  } as ScoredListing;
}

const ANY = { minRent: 0, maxRent: 100_000, minBedrooms: null, maxBedrooms: null, limit: 100 };

describe('getListings', () => {
  beforeEach(() => {
    db.exec('DELETE FROM inventory; DELETE FROM house_rules');
    storeListings(
      [
        stored({ key: 'tenderloin', neighborhood: 'Tenderloin', price: 2000 }),
        stored({ key: 'mission', neighborhood: 'Mission District', price: 4200 }),
      ],
      Date.now(),
    );
  });

  it('drops a listing in a neighborhood the group ruled out', async () => {
    setHouseRules(houseRulesSchema.parse({ excludedNeighborhoods: ['Tenderloin'] }), 'jack@example.com');

    const { listings } = await getListings(ANY);
    expect(listings.map((l) => l.key)).toEqual(['mission']);
  });

  it('still resolves a ruled-out listing by key, so a saved one stays readable', async () => {
    setHouseRules(houseRulesSchema.parse({ excludedNeighborhoods: ['Tenderloin'] }), 'jack@example.com');

    expect((await findListings(['tenderloin'])).map((l) => l.key)).toEqual(['tenderloin']);
  });
});

describe('fillMissingFacts', () => {
  it('borrows bathrooms and floor area from the other source for the same unit size', () => {
    const thin = listing({ externalId: 'thin' });
    const rich = listing({
      sourceId: 'apartmentlist',
      externalId: 'rich',
      address: '123 valencia street',
      bathrooms: 2,
      sqft: 950,
    });

    fillMissingFacts([thin, rich]);

    expect(thin.bathrooms).toBe(2);
    expect(thin.sqft).toBe(950);
  });

  it('records which source the borrowed numbers came from', () => {
    const thin = listing({ externalId: 'thin' });
    const rich = listing({
      sourceId: 'apartmentlist',
      sourceName: 'ApartmentList',
      externalId: 'rich',
      bathrooms: 2,
      sqft: 950,
    });

    fillMissingFacts([thin, rich]);

    expect(thin.factsFrom).toBe('ApartmentList');
    expect(rich.factsFrom).toBeUndefined();
  });

  it('never borrows across a different unit size', () => {
    const twoBed = listing({ externalId: 'two' });
    const studio = listing({ externalId: 'studio', bedrooms: 0, bathrooms: 1, sqft: 400 });

    fillMissingFacts([twoBed, studio]);

    expect(twoBed.bathrooms).toBeNull();
  });

  it('leaves a listing that already published its own numbers alone', () => {
    const own = listing({ externalId: 'own', bathrooms: 1, sqft: 800 });
    const other = listing({ externalId: 'other', address: '123 valencia street', bathrooms: 3, sqft: 2000 });

    fillMissingFacts([own, other]);

    expect(own).toMatchObject({ bathrooms: 1, sqft: 800 });
  });

  it('cannot match listings with no address', () => {
    const anonymous = listing({ externalId: 'anon', address: '' });
    fillMissingFacts([anonymous, listing({ externalId: 'known', bathrooms: 2 })]);
    expect(anonymous.bathrooms).toBeNull();
  });
});
