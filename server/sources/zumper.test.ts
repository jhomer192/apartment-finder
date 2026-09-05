import { afterEach, describe, expect, it, vi } from 'vitest';
import { zumperSource } from './zumper.js';

interface Listable {
  listing_id: number;
  address: string;
  min_price: number;
  min_bedrooms: number;
}

function listable(id: number, price: number, beds = 1): Listable {
  return { listing_id: id, address: `${id} Valencia St`, min_price: price, min_bedrooms: beds };
}

/** Stands in for Zumper: answers each POST with the asked-for slice of the city. */
function mockCity(all: Listable[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { offset?: number; limit: number };
    const offset = body.offset ?? 0;
    const listables = all.slice(offset, offset + body.limit);
    return Promise.resolve(new Response(JSON.stringify({ listables }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('zumperSource', () => {
  it('collects every page of the city', async () => {
    const all = Array.from({ length: 250 }, (_, index) => listable(index + 1, 3000 + index));
    mockCity(all);

    const listings = await zumperSource.fetchAll!();

    expect(listings).toHaveLength(250);
    expect(new Set(listings.map((listing) => listing.externalId)).size).toBe(250);
  });

  it('stops asking once a page comes back short', async () => {
    const fetchMock = mockCity([listable(1, 3000), listable(2, 4000)]);

    await zumperSource.fetchAll!();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks listings as summaries so missing photos are not held against them', async () => {
    mockCity([listable(1, 3000)]);

    const [listing] = await zumperSource.fetchAll!();

    expect(listing.detail).toBe('summary');
    expect(listing.imageUrls).toEqual([]);
    expect(listing.url).toContain('zumper.com');
  });

  it('filters a search by rent and bedrooms', async () => {
    mockCity([listable(1, 3000, 1), listable(2, 9000, 3)]);

    const listings = await zumperSource.fetchListings({
      minRent: 0,
      maxRent: 5000,
      minBedrooms: null,
      maxBedrooms: null,
      limit: 10,
    });

    expect(listings.map((listing) => listing.price)).toEqual([3000]);
  });

  it('complains when the feed shape changes rather than reporting an empty city', async () => {
    mockCity([]);

    await expect(zumperSource.fetchAll!()).rejects.toThrow(/Zumper/);
  });
});
