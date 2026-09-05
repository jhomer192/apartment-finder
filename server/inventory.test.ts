import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import {
  inventoryByKeys,
  inventoryStatus,
  inventorySize,
  msUntilNextCrawl,
  queryInventory,
  refreshInventory,
  storeListings,
} from './inventory.js';
import { SOURCES, type ScoredListing } from './scoring.js';
import type { ListingSource, RawListing, SourceQuery } from './sources/types.js';

function raw(overrides: Partial<RawListing> = {}): RawListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: '1',
    title: '2 Bedroom in the Mission',
    description: 'A normal listing with photos, a lease, and an application.',
    price: 4200,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    address: '123 Valencia St',
    city: 'San Francisco',
    // No coordinates: area facts come from live civic feeds, which a test must not call.
    lat: null,
    lng: null,
    url: 'https://example.com/1',
    imageUrl: 'https://example.com/1.jpg',
    imageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    photoCount: 2,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    ...overrides,
  };
}

function scored(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    ...raw(),
    key: 'redfin:1',
    neighborhood: 'Mission',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  };
}

const ANY: SourceQuery = { minRent: 0, maxRent: 100_000, minBedrooms: null, maxBedrooms: null, limit: 500 };

function fakeSource(overrides: Partial<ListingSource>): ListingSource {
  return {
    id: 'fake',
    name: 'Fake',
    enabled: true,
    fetchListings: () => Promise.resolve([]),
    ...overrides,
  };
}

const realSources = [...SOURCES];

function useSources(...sources: ListingSource[]): void {
  SOURCES.splice(0, SOURCES.length, ...sources);
}

beforeEach(() => {
  db.exec('DELETE FROM inventory; DELETE FROM inventory_runs; DELETE FROM scam_assessments');
});

afterEach(() => {
  useSources(...realSources);
});

describe('storeListings', () => {
  it('keeps the first-seen time when a listing comes back in a later crawl', () => {
    storeListings([scored({ price: 4200 })], 1_000);
    storeListings([scored({ price: 3900 })], 2_000);

    const row = db.prepare('SELECT price, first_seen_at, last_seen_at FROM inventory').get() as {
      price: number;
      first_seen_at: number;
      last_seen_at: number;
    };
    expect(row).toEqual({ price: 3900, first_seen_at: 1_000, last_seen_at: 2_000 });
    expect(inventorySize()).toBe(1);
  });
});

describe('queryInventory', () => {
  beforeEach(() => {
    storeListings(
      [
        scored({ key: 'a', price: 2000, bedrooms: 0 }),
        scored({ key: 'b', price: 4200, bedrooms: 2 }),
        scored({ key: 'c', price: 9000, bedrooms: 4 }),
      ],
      Date.now(),
    );
  });

  it('filters on rent and bedrooms and returns the cheapest first', () => {
    expect(queryInventory({ ...ANY, maxRent: 5000 }).map((l) => l.key)).toEqual(['a', 'b']);
    expect(queryInventory({ ...ANY, minBedrooms: 2, maxBedrooms: 3 }).map((l) => l.key)).toEqual(['b']);
  });

  it('honours the limit', () => {
    expect(queryInventory({ ...ANY, limit: 2 })).toHaveLength(2);
  });

  it('resolves saved listings by key', () => {
    expect(inventoryByKeys(['c', 'missing']).map((l) => l.key)).toEqual(['c']);
    expect(inventoryByKeys([])).toEqual([]);
  });
});

describe('refreshInventory', () => {
  it('prefers a source crawl over its single-page search', async () => {
    useSources(
      fakeSource({
        fetchAll: () => Promise.resolve([raw({ externalId: 'crawled' })]),
        fetchListings: () => Promise.resolve([raw({ externalId: 'searched' })]),
      }),
    );

    const result = await refreshInventory();

    expect(result.listings).toBe(1);
    expect(queryInventory(ANY)[0].url).toBe('https://example.com/1');
    expect(inventoryStatus().sources).toEqual([
      { id: 'fake', name: 'Fake', enabled: true, count: 1, error: null },
    ]);
  });

  it('keeps the stored listings when every source fails', async () => {
    storeListings([scored({ key: 'kept' })], Date.now());
    useSources(fakeSource({ fetchAll: () => Promise.reject(new Error('403')) }));

    await refreshInventory();

    expect(inventoryByKeys(['kept'])).toHaveLength(1);
    expect(inventoryStatus().sources[0].error).toBe('403');
  });

  it('drops listings no source has published for a week', async () => {
    storeListings([scored({ key: 'gone' })], Date.now() - 30 * 24 * 60 * 60 * 1000);
    useSources(fakeSource({ fetchAll: () => Promise.resolve([raw({ externalId: 'fresh' })]) }));

    await refreshInventory();

    expect(inventoryByKeys(['gone'])).toEqual([]);
    expect(inventorySize()).toBe(1);
  });

  it('runs one crawl at a time', async () => {
    let calls = 0;
    useSources(
      fakeSource({
        fetchAll: async () => {
          calls += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return [raw()];
        },
      }),
    );

    const first = refreshInventory();
    expect(refreshInventory()).toBe(first);
    expect(inventoryStatus().refreshing).toBe(true);

    await first;

    expect(calls).toBe(1);
    expect(inventoryStatus().refreshing).toBe(false);
  });
});

describe('msUntilNextCrawl', () => {
  it('waits for tonight when the hour has not passed yet', () => {
    const now = new Date(2026, 8, 5, 1, 0, 0);
    expect(msUntilNextCrawl(now)).toBe(2 * 60 * 60 * 1000);
  });

  it('waits for tomorrow once it has', () => {
    const now = new Date(2026, 8, 5, 4, 0, 0);
    expect(msUntilNextCrawl(now)).toBe(23 * 60 * 60 * 1000);
  });
});
