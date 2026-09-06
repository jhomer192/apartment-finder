import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { HIDE_AFTER, addDislike, dislikeSummary, hiddenKeys, removeDislike } from './dislikes.js';
import { storeListings } from './inventory.js';
import { getListings, type ScoredListing } from './listings.js';

function stored(key: string): ScoredListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: key,
    key: `redfin:${key}`,
    title: 'Place',
    description: '',
    price: 4000,
    bedrooms: 2,
    bathrooms: null,
    sqft: null,
    address: `${key} Valencia St`,
    city: 'San Francisco',
    neighborhood: 'Mission District',
    lat: 37.76,
    lng: -122.42,
    url: `https://example.com/${key}`,
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
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

describe('dislikes', () => {
  beforeEach(() => {
    db.exec('DELETE FROM listing_dislikes; DELETE FROM inventory; DELETE FROM house_rules');
    storeListings([stored('a'), stored('b')], Date.now());
  });

  it('counts distinct roommates once each and remembers who voted', () => {
    addDislike('redfin:a', 'jack@example.com');
    addDislike('redfin:a', 'jack@example.com');
    addDislike('redfin:a', 'garrett@example.com');

    const summary = dislikeSummary('jack@example.com');
    expect(summary.counts).toEqual({ 'redfin:a': 2 });
    expect(summary.mine).toEqual(['redfin:a']);
    expect(summary.hideAfter).toBe(HIDE_AFTER);
    expect(dislikeSummary('brady@example.com').mine).toEqual([]);
  });

  it('hides a listing from searches only once enough people dislike it', async () => {
    addDislike('redfin:a', 'one@example.com');
    addDislike('redfin:a', 'two@example.com');
    expect(hiddenKeys().size).toBe(0);
    expect((await getListings(ANY)).listings.map((l) => l.key).sort()).toEqual(['redfin:a', 'redfin:b']);

    addDislike('redfin:a', 'three@example.com');
    expect([...hiddenKeys()]).toEqual(['redfin:a']);
    expect((await getListings(ANY)).listings.map((l) => l.key)).toEqual(['redfin:b']);
    expect((await getListings({ ...ANY, includeHidden: true })).listings).toHaveLength(2);
  });

  it('un-disliking drops the listing back under the threshold', () => {
    for (const who of ['one', 'two', 'three']) addDislike('redfin:a', `${who}@example.com`);
    expect(removeDislike('redfin:a', 'two@example.com')).toBe(true);
    expect(removeDislike('redfin:a', 'two@example.com')).toBe(false);
    expect(hiddenKeys().size).toBe(0);
  });
});
