import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { availabilityFor, changedPrices, pruneHistory } from './history.js';
import { inventoryByKeys, storeListings } from './inventory.js';
import type { ScoredListing } from './scoring.js';

function scored(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: '1',
    title: '2 Bedroom in the Mission',
    description: 'A normal listing.',
    price: 4200,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    address: '123 Valencia St',
    city: 'San Francisco',
    lat: null,
    lng: null,
    url: 'https://example.com/1',
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    key: 'redfin:1',
    neighborhood: 'Mission',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  };
}

function finishRun(finishedAt: number, sources: Array<{ id: string; count: number }>): void {
  db.prepare('INSERT INTO inventory_runs (started_at, finished_at, listings, sources) VALUES (?, ?, ?, ?)').run(
    finishedAt - 1000,
    finishedAt,
    sources.reduce((sum, s) => sum + s.count, 0),
    JSON.stringify(sources.map((s) => ({ ...s, name: s.id, enabled: true, error: null }))),
  );
}

const ref = (key: string, url = 'https://example.com/1') => ({ key, url });

beforeEach(() => {
  db.exec('DELETE FROM inventory; DELETE FROM inventory_runs; DELETE FROM listing_prices');
});

describe('price history', () => {
  it('records a row only when the rent moves', () => {
    storeListings([scored({ price: 4200 })], 1_000);
    storeListings([scored({ price: 4200 })], 2_000);
    storeListings([scored({ price: 3900 })], 3_000);

    expect(changedPrices().get('redfin:1')).toEqual([
      { price: 4200, at: 1_000 },
      { price: 3900, at: 3_000 },
    ]);
  });

  it('leaves the series empty on a listing whose rent never changed', () => {
    storeListings([scored()], 1_000);
    storeListings([scored()], 2_000);

    const [listing] = inventoryByKeys(['redfin:1']);
    expect(listing.history).toEqual({ firstSeenAt: 1_000, lastSeenAt: 2_000, prices: [] });
  });

  it('forgets listings the inventory has dropped', () => {
    storeListings([scored({ key: 'a' }), scored({ key: 'b', price: 1 })], 1_000);
    db.prepare("DELETE FROM inventory WHERE listing_key = 'a'").run();

    pruneHistory();

    expect(db.prepare('SELECT DISTINCT listing_key FROM listing_prices').pluck().all()).toEqual(['b']);
  });
});

describe('availabilityFor', () => {
  it('reports a listing the latest crawl still returned as listed', () => {
    storeListings([scored({ price: 4000 })], 5_000);
    finishRun(5_000, [{ id: 'redfin', count: 1 }]);

    expect(availabilityFor([ref('redfin:1')]).get('redfin:1')).toEqual({
      status: 'listed',
      lastSeenAt: 5_000,
      currentPrice: 4000,
    });
  });

  it('reports a listing its source stopped returning as gone', () => {
    storeListings([scored()], 5_000);
    finishRun(9_000, [{ id: 'redfin', count: 40 }]);

    expect(availabilityFor([ref('redfin:1')]).get('redfin:1')?.status).toBe('gone');
  });

  it('does not read a failed source as a delisting', () => {
    storeListings([scored()], 5_000);
    finishRun(9_000, [{ id: 'redfin', count: 0 }, { id: 'zumper', count: 300 }]);

    expect(availabilityFor([ref('redfin:1')]).get('redfin:1')?.status).toBe('listed');
  });

  it('treats a pruned listing as gone once any crawl has finished', () => {
    finishRun(9_000, [{ id: 'redfin', count: 40 }]);
    expect(availabilityFor([ref('redfin:old')]).get('redfin:old')?.status).toBe('gone');
  });

  it('follows the same page URL when the source rotates its listing id', () => {
    storeListings([scored({ key: 'redfin:old', externalId: 'old' })], 5_000);
    storeListings([scored({ key: 'redfin:new', externalId: 'new', price: 3900 })], 9_000);
    finishRun(9_000, [{ id: 'redfin', count: 40 }]);

    expect(availabilityFor([ref('redfin:old')]).get('redfin:old')).toEqual({
      status: 'listed',
      lastSeenAt: 9_000,
      currentPrice: 3900,
    });
  });

  it('cannot tell before the first crawl', () => {
    expect(availabilityFor([ref('redfin:1')]).get('redfin:1')?.status).toBe('unknown');
  });
});
