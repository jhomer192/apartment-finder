import { describe, expect, it } from 'vitest';
import { fillMissingFacts } from './listings.js';
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
