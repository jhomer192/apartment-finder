import { afterEach, describe, expect, it, vi } from 'vitest';
import { apartmentListSource, unitFacts, unitsFromPropertyPage } from './apartmentlist.js';

/** Rebuilds the RSC flight framing the real page uses: JSON inside pushed string chunks. */
function page(...objects: unknown[]): string {
  const payload = objects.map((object) => JSON.stringify(object)).join(',');
  const chunks = [`{"initialResults":{"listings":[${payload}]}}`];
  return chunks
    .map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`)
    .join('');
}

const summary = {
  rental_id: 'p1',
  display_name: 'Plain Building',
  slug: '/ca/san-francisco/plain-building',
  lat: 37.76,
  lon: -122.42,
  prices: { '0': null, '1': 3200, '2': 4800, '3': null },
};

const card = {
  rental_id: 'p1',
  display_name: 'Plain Building',
  formatted_address: '1 Market St, San Francisco, CA 94105',
  neighborhood: 'SoMa',
  phone: '(415) 555-0100',
  amenitiesText: 'In unit laundry, Gym',
  all_photos: [{ id: 'a' }, { id: 'b' }],
  first_photo: [{ id: 'a' }],
  updated_at: '2026-09-04T21:56:31Z',
  sampleSummary: { text: 'A quiet building near transit.' },
};

function mockPage(html: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(html, { status: 200 })),
  );
}

const anyQuery = { minRent: 0, maxRent: 20_000, minBedrooms: null, maxBedrooms: null, limit: 50 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apartmentListSource', () => {
  it('takes the cheapest advertised unit when no bedroom count is asked for', async () => {
    mockPage(page(summary));
    const [listing] = await apartmentListSource.fetchListings(anyQuery);
    expect(listing.price).toBe(3200);
    expect(listing.bedrooms).toBe(1);
  });

  it('prices the requested bedroom count and drops properties without one', async () => {
    mockPage(page(summary));
    const [twoBed] = await apartmentListSource.fetchListings({ ...anyQuery, minBedrooms: 2, maxBedrooms: 2 });
    expect(twoBed.price).toBe(4800);
    expect(await apartmentListSource.fetchListings({ ...anyQuery, minBedrooms: 3, maxBedrooms: 3 })).toEqual([]);
  });

  it('quotes the cheapest unit inside a bedroom range', async () => {
    mockPage(page(summary));
    const [listing] = await apartmentListSource.fetchListings({ ...anyQuery, minBedrooms: 2, maxBedrooms: 4 });
    expect(listing).toMatchObject({ price: 4800, bedrooms: 2 });
  });

  it('merges the card details that carry the address and phone number', async () => {
    mockPage(page(summary, card));
    const [listing] = await apartmentListSource.fetchListings(anyQuery);
    expect(listing).toMatchObject({
      detail: 'full',
      address: '1 Market St, San Francisco, CA 94105',
      contactPhone: '(415) 555-0100',
      photoCount: 2,
      url: 'https://www.apartmentlist.com/ca/san-francisco/plain-building',
    });
    expect(listing.description).toContain('quiet building');
  });

  it('marks properties with no card as summaries rather than inventing gaps', async () => {
    mockPage(page(summary));
    const [listing] = await apartmentListSource.fetchListings(anyQuery);
    expect(listing.detail).toBe('summary');
    expect(listing.address).toBe('');
    expect(listing.photoCount).toBe(0);
  });

  it('applies the rent filter', async () => {
    mockPage(page(summary));
    expect(await apartmentListSource.fetchListings({ ...anyQuery, minRent: 4000 })).toEqual([]);
  });

  it('raises rather than reporting an empty market when the markup changes', async () => {
    mockPage('<html><body>nothing here</body></html>');
    await expect(apartmentListSource.fetchListings(anyQuery)).rejects.toThrow(/markup/);
  });
});

describe('apartmentListSource.fetchAll', () => {
  /** Pages carry a total so the crawl knows when to stop asking for more. */
  function pageOf(objects: unknown[], totalCount: number): string {
    return `${page(...objects)}<script>{"totalCount": ${totalCount}}</script>`;
  }

  it('keeps every advertised unit size, not just the cheapest', async () => {
    mockPage(pageOf([summary, card], 1));

    const listings = await apartmentListSource.fetchAll!();

    expect(listings.map((listing) => ({ beds: listing.bedrooms, price: listing.price }))).toEqual([
      { beds: 1, price: 3200 },
      { beds: 2, price: 4800 },
    ]);
    expect(new Set(listings.map((listing) => listing.externalId)).size).toBe(2);
  });

  it('walks the pages the total count implies and merges them', async () => {
    const pages = [
      pageOf([{ ...summary, rental_id: 'p1', slug: '/ca/san-francisco/one' }], 32),
      pageOf([{ ...summary, rental_id: 'p2', slug: '/ca/san-francisco/two' }], 32),
    ];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const html = pages[Math.min(call, pages.length - 1)];
        call += 1;
        return Promise.resolve(new Response(html, { status: 200 }));
      }),
    );

    const listings = await apartmentListSource.fetchAll!();

    expect(new Set(listings.map((listing) => listing.url)).size).toBe(2);
  });
});

describe('unitsFromPropertyPage', () => {
  it('reads floor plans out of an inline payload', () => {
    const html = '<script>{"available_units":[{"id":1,"bed":2,"bath":2,"sqft":1100},{"id":2,"bed":1,"bath":1,"sqft":700}]}</script>';
    expect(unitsFromPropertyPage(html)).toEqual([
      { bed: 2, bath: 2, sqft: 1100 },
      { bed: 1, bath: 1, sqft: 700 },
    ]);
  });

  it('reads them out of an escaped flight chunk too', () => {
    const html = String.raw`self.__next_f.push([1,"{\"bed\":3,\"bath\":2.5,\"sqft\":1400}"])`;
    expect(unitsFromPropertyPage(html)).toEqual([{ bed: 3, bath: 2.5, sqft: 1400 }]);
  });
});

describe('unitFacts', () => {
  const units = [
    { bed: 2, bath: 1, sqft: 800 },
    { bed: 2, bath: 2, sqft: 1000 },
    { bed: 2, bath: 2, sqft: 1200 },
    { bed: 1, bath: 1, sqft: 600 },
  ];

  it('reports the typical unit of the size we priced', () => {
    expect(unitFacts(units, 2)).toEqual({ bathrooms: 2, sqft: 1000 });
    expect(unitFacts(units, 1)).toEqual({ bathrooms: 1, sqft: 600 });
  });

  it('stays silent when the property lists nothing of that size', () => {
    expect(unitFacts(units, 4)).toEqual({ bathrooms: null, sqft: null });
  });

  it('ignores units that publish no number', () => {
    expect(unitFacts([{ bed: 2, bath: 0, sqft: 0 }], 2)).toEqual({ bathrooms: null, sqft: null });
  });
});
