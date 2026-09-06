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

const ANY = {
  minRent: 0,
  maxRent: 100_000,
  minBedrooms: null,
  maxBedrooms: null,
  limit: 100,
  dedupe: false,
  includeHidden: false,
};

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

describe('getListings de-duplication', () => {
  beforeEach(() => {
    db.exec('DELETE FROM inventory; DELETE FROM house_rules');
    storeListings(
      [
        stored({ key: 'redfin:1', address: '2055 Sacramento St', price: 4200 }),
        stored({
          key: 'zumper:1',
          sourceId: 'zumper',
          sourceName: 'Zumper',
          url: 'https://zumper.example/1',
          address: '2055 sacramento street, San Francisco, CA',
          price: 4200,
        }),
        stored({ key: 'redfin:2', address: '2055 Sacramento St #310', price: 5000 }),
      ],
      Date.now(),
    );
  });

  it('shows one card per apartment and hangs the other site off it', async () => {
    const { listings } = await getListings({ ...ANY, dedupe: true });

    expect(listings.map((l) => l.key)).toEqual(['redfin:1', 'redfin:2']);
    expect(listings[0].alsoOn).toEqual([
      { sourceId: 'zumper', sourceName: 'Zumper', url: 'https://zumper.example/1' },
    ]);
  });

  it('shows every site’s copy when the reader turns de-duplication off', async () => {
    const { listings } = await getListings({ ...ANY, dedupe: false });

    expect(listings.map((l) => l.key)).toEqual(['redfin:1', 'zumper:1', 'redfin:2']);
    expect(listings.every((l) => l.alsoOn === undefined)).toBe(true);
  });

  it('spends the limit on apartments rather than on the copies it collapses', async () => {
    const { listings } = await getListings({ ...ANY, dedupe: true, limit: 2 });

    expect(listings.map((l) => l.key)).toEqual(['redfin:1', 'redfin:2']);
  });

  it('does not collapse a listing the group ruled out into a surviving card', async () => {
    setHouseRules(houseRulesSchema.parse({ maxRent: 4500 }), 'jack@example.com');

    const { listings } = await getListings({ ...ANY, dedupe: true });
    expect(listings.map((l) => l.key)).toEqual(['redfin:1']);
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
