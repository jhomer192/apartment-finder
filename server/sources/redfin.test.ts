import { afterEach, describe, expect, it, vi } from 'vitest';
import { redfinSource } from './redfin.js';

/** The API truncates any response at this many homes. */
const CAP = 350;

function home(id: number, price: number): unknown {
  return {
    homeData: {
      propertyId: String(id),
      url: `/CA/San-Francisco/${id}`,
      addressInfo: { formattedStreetLine: `${id} Valencia St`, city: 'San Francisco' },
    },
    rentalExtension: { rentalId: `r${id}`, propertyName: `Unit ${id}`, rentPriceRange: { min: price } },
  };
}

/**
 * Stands in for Redfin: every rental sits at a distinct price, and a request is
 * answered with the ones inside the asked-for band, truncated at the cap.
 */
function mockCity(prices: number[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string) => {
    const params = new URL(url).searchParams;
    const min = Number(params.get('min_price') ?? 0);
    const max = Number(params.get('max_price') ?? Number.MAX_SAFE_INTEGER);
    const matching = prices
      .map((price, index) => ({ price, index }))
      .filter(({ price }) => price >= min && price <= max);
    const homes = matching.slice(0, CAP).map(({ price, index }) => home(index, price));
    return Promise.resolve(
      new Response(JSON.stringify({ homes, numMatchedHomes: matching.length }), { status: 200 }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('redfinSource.fetchAll', () => {
  it('splits the rent filter until the whole city fits under the response cap', async () => {
    // 600 rentals spread over the city's real rent range: no single request can
    // return them all.
    const prices = Array.from({ length: 600 }, (_, index) => 1000 + index * 10);
    mockCity(prices);

    const listings = await redfinSource.fetchAll!();

    expect(listings).toHaveLength(600);
    expect(new Set(listings.map((listing) => listing.externalId)).size).toBe(600);
  });

  it('asks once when the first response already fits', async () => {
    const fetchMock = mockCity([2000, 3000, 4000]);

    const listings = await redfinSource.fetchAll!();

    expect(listings).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up on a band it cannot split any further rather than looping', async () => {
    // Every rental priced identically: narrowing the band never thins the results.
    const fetchMock = mockCity(Array.from({ length: 400 }, () => 3000));

    const listings = await redfinSource.fetchAll!();

    expect(listings).toHaveLength(CAP);
    expect(fetchMock.mock.calls.length).toBeLessThan(40);
  });
});
