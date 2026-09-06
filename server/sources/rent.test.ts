import { afterEach, describe, expect, it, vi } from 'vitest';
import { listingsFromProperty, propertiesFromSearchPage, rentSource } from './rent.js';

function property(id: string, plans: Array<{ beds: number; price: number; sqft?: number; baths?: number }>): unknown {
  return {
    id,
    name: `Building ${id}`,
    addressFull: `${id} Valencia St, San Francisco, CA 94110`,
    urlPathname: `/apartment/${id}`,
    location: { lat: 37.75, lng: -122.42 },
    optimizedPhotos: [{ id: 'photo-a' }, { id: 'photo-b' }],
    amenitiesHighlighted: ['Dishwasher'],
    phoneDesktop: '4155551234',
    floorPlans: plans.map((plan) => ({
      bedCount: plan.beds,
      bathCount: plan.baths ?? 1,
      priceRange: { min: plan.price, max: plan.price },
      sqFtRange: { min: plan.sqft ?? null, max: plan.sqft ?? null },
      photos: [],
    })),
  };
}

function page(properties: unknown[], total: number): string {
  const payload = { props: { pageProps: { pageData: { location: { listingSearch: { listings: properties, total } } } } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}

function mockCity(properties: unknown[], pageSize = 30): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string) => {
    const number = Number(new URL(url).searchParams.get('page') ?? 1);
    const slice = properties.slice((number - 1) * pageSize, number * pageSize);
    return Promise.resolve(new Response(page(slice, properties.length), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listingsFromProperty', () => {
  it('keeps one listing per unit size instead of only the cheapest', () => {
    const listings = listingsFromProperty(
      property('lc1', [
        { beds: 0, price: 2500 },
        { beds: 2, price: 4200, sqft: 900, baths: 2 },
      ]) as Parameters<typeof listingsFromProperty>[0],
    );

    expect(listings.map((listing) => [listing.bedrooms, listing.price])).toEqual([
      [0, 2500],
      [2, 4200],
    ]);
    expect(listings[1].sqft).toBe(900);
    expect(listings[1].bathrooms).toBe(2);
    expect(listings.map((listing) => listing.externalId)).toEqual(['lc1-0bd', 'lc1-2bd']);
  });

  it('quotes the cheapest floor plan of a size the building repeats', () => {
    const listings = listingsFromProperty(
      property('lc2', [
        { beds: 1, price: 3900 },
        { beds: 1, price: 3100 },
      ]) as Parameters<typeof listingsFromProperty>[0],
    );

    expect(listings).toHaveLength(1);
    expect(listings[0].price).toBe(3100);
  });

  it('builds openable photo URLs from the photo ids', () => {
    const [listing] = listingsFromProperty(
      property('lc3', [{ beds: 1, price: 3000 }]) as Parameters<typeof listingsFromProperty>[0],
    );

    expect(listing.imageUrls).toEqual([
      'https://i.rent.com/t_3x2_fixed_webp_lg/photo-a',
      'https://i.rent.com/t_3x2_fixed_webp_lg/photo-b',
    ]);
    expect(listing.imageUrl).toBe(listing.imageUrls[0]);
  });
});

describe('propertiesFromSearchPage', () => {
  it('rejects a page whose embedded JSON is gone rather than reporting no rentals', () => {
    expect(() => propertiesFromSearchPage('<html><body>blocked</body></html>')).toThrow(/__NEXT_DATA__/);
  });
});

describe('rentSource.fetchAll', () => {
  it('walks every page the search reports', async () => {
    const properties = Array.from({ length: 70 }, (_, index) =>
      property(`lc${index}`, [{ beds: 1, price: 3000 + index }]),
    );
    const fetchMock = mockCity(properties);

    const listings = await rentSource.fetchAll!();

    expect(listings).toHaveLength(70);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('complains when the city comes back empty rather than wiping the store', async () => {
    mockCity([]);

    await expect(rentSource.fetchAll!()).rejects.toThrow(/Rent\.com/);
  });
});
