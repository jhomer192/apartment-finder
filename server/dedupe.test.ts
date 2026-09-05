import { describe, expect, it } from 'vitest';
import { absorb, duplicateKey } from './dedupe.js';
import type { ScoredListing } from './scoring.js';

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    key: 'redfin:abc',
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: 'abc',
    title: '2 Bedroom',
    description: '',
    price: 4200,
    bedrooms: 2,
    bathrooms: null,
    sqft: null,
    address: '1234 Market St',
    city: 'San Francisco',
    lat: 37.76,
    lng: -122.42,
    url: 'https://redfin.example/abc',
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    neighborhood: 'Mission District',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  } as ScoredListing;
}

const same = (a: Partial<ScoredListing>, b: Partial<ScoredListing>) =>
  duplicateKey(listing(a)) === duplicateKey(listing(b));

describe('duplicateKey', () => {
  it('reads the same building through the formatting each site uses', () => {
    expect(
      same(
        { address: '1234 Market St #5' },
        { address: '1234 market street Apt. 5, San Francisco, CA 94103' },
      ),
    ).toBe(true);
  });

  it('joins the same unit posted to two sites', () => {
    expect(
      same(
        { sourceId: 'redfin', address: '2055 Sacramento St' },
        { sourceId: 'zumper', address: '2055 Sacramento St' },
      ),
    ).toBe(true);
  });

  it('keeps two units in the same building apart', () => {
    expect(same({ address: '990 Fulton St #309' }, { address: '990 Fulton St #310' })).toBe(false);
  });

  it('keeps a studio and a three-bed in the same building apart', () => {
    expect(same({ bedrooms: 0 }, { bedrooms: 3 })).toBe(false);
  });

  it('keeps postings apart when the sites disagree on the rent', () => {
    expect(same({ price: 4200 }, { price: 4350 })).toBe(false);
  });

  it('places an addressless listing by its coordinates', () => {
    expect(same({ address: '', sourceId: 'apartmentlist' }, { address: '' })).toBe(true);
  });

  it('does not treat two listings with neither address nor coordinates as the same place', () => {
    expect(
      same(
        { key: 'a', address: '', lat: null, lng: null },
        { key: 'b', address: '', lat: null, lng: null },
      ),
    ).toBe(false);
  });

  it('does not join two buildings that share a map pin', () => {
    expect(same({ address: '1049 Post St' }, { address: '1053 Post St' })).toBe(false);
  });
});

describe('absorb', () => {
  it('keeps the other site reachable and fills in what the first left blank', () => {
    const primary = listing({ bathrooms: null, sqft: null, description: '' });
    absorb(
      primary,
      listing({
        sourceId: 'zumper',
        sourceName: 'Zumper',
        url: 'https://zumper.example/xyz',
        bathrooms: 2,
        sqft: 900,
        description: 'Top floor corner unit',
      }),
    );

    expect(primary.alsoOn).toEqual([
      { sourceId: 'zumper', sourceName: 'Zumper', url: 'https://zumper.example/xyz' },
    ]);
    expect(primary.bathrooms).toBe(2);
    expect(primary.sqft).toBe(900);
    expect(primary.description).toBe('Top floor corner unit');
  });

  it('takes a gallery from the other site when this one published none', () => {
    const primary = listing();
    absorb(
      primary,
      listing({
        sourceId: 'rent',
        sourceName: 'Rent.com',
        imageUrl: 'https://img.example/1.jpg',
        imageUrls: ['https://img.example/1.jpg', 'https://img.example/2.jpg'],
        photoCount: 2,
      }),
    );

    expect(primary.imageUrls).toHaveLength(2);
    expect(primary.photoCount).toBe(2);
  });

  it('does not overwrite facts the listing already published', () => {
    const primary = listing({ bathrooms: 1, sqft: 700, description: 'Own copy' });
    absorb(primary, listing({ sourceId: 'zumper', bathrooms: 3, sqft: 1200, description: 'Other' }));

    expect(primary.bathrooms).toBe(1);
    expect(primary.sqft).toBe(700);
    expect(primary.description).toBe('Own copy');
  });

  it('does not link a site to itself', () => {
    const primary = listing();
    absorb(primary, listing({ key: 'redfin:def', url: 'https://redfin.example/def' }));

    expect(primary.alsoOn).toBeUndefined();
  });
});
