import { fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const SEARCH_URL = 'https://www.apartmentlist.com/ca/san-francisco';
const ORIGIN = 'https://www.apartmentlist.com';
const PHOTO_BASE = 'https://cdn.apartmentlist.com/image/upload/f_auto,q_auto,t_web-base';

/** Every property in the search area: name, coordinates, and price per bed count. */
interface SearchResult {
  rental_id?: string;
  display_name?: string;
  slug?: string;
  lat?: number;
  lon?: number;
  prices?: Record<string, number | null>;
}

/** The subset of properties the page renders as cards, which carry contact details. */
interface CardDetail {
  rental_id?: string;
  formatted_address?: string;
  neighborhood?: string;
  phone?: string;
  amenitiesText?: string;
  all_photos?: unknown[];
  first_photo?: Array<{ id?: string }>;
  updated_at?: string;
  unitsAvailable?: number;
  sampleSummary?: { title?: string; text?: string };
}

/**
 * The page is a Next.js app whose data arrives as RSC flight chunks pushed into
 * `self.__next_f`. Concatenating the chunk payloads reconstructs one string that
 * contains the JSON we want; the flight framing around it is not valid JSON.
 */
function flightPayload(html: string): string {
  let payload = '';
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      payload += JSON.parse(match[1]) as string;
    } catch {
      // A truncated chunk only costs us the listings it held.
    }
  }
  return payload;
}

/**
 * Walks `payload` once tracking string state, so braces inside listing text
 * cannot desynchronise the scan, and returns every top-most object that holds
 * all of `keys`.
 */
function objectsWith<T>(payload: string, keys: string[]): T[] {
  const found: T[] = [];
  const stack: number[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < payload.length; i += 1) {
    const char = payload[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') stack.push(i);
    else if (char === '}') {
      const start = stack.pop();
      if (start === undefined) continue;
      const text = payload.slice(start, i + 1);
      if (!keys.every((key) => text.includes(`"${key}"`))) continue;
      try {
        found.push(JSON.parse(text) as T);
        // The match is complete: skip any enclosing object that repeats it.
        stack.length = 0;
      } catch {
        // Not the object we are after.
      }
    }
  }

  return found;
}

function photoUrl(detail: CardDetail | undefined): string | null {
  const id = detail?.first_photo?.[0]?.id;
  return id ? `${PHOTO_BASE}/${id}.jpg` : null;
}

/**
 * `prices` is keyed by bed count, so a bedroom filter picks a specific unit type
 * and an unfiltered search takes the cheapest advertised unit.
 */
function priceFor(prices: Record<string, number | null>, bedrooms: number | null): { price: number; bedrooms: number } | null {
  if (bedrooms !== null) {
    const price = prices[String(bedrooms)];
    return typeof price === 'number' && price > 0 ? { price, bedrooms } : null;
  }

  let best: { price: number; bedrooms: number } | null = null;
  for (const [beds, price] of Object.entries(prices)) {
    if (typeof price !== 'number' || price <= 0) continue;
    if (!best || price < best.price) best = { price, bedrooms: Number(beds) };
  }
  return best;
}

function describe(detail: CardDetail | undefined): string {
  return [detail?.sampleSummary?.text, detail?.amenitiesText].filter(Boolean).join(' ').trim();
}

function toListing(result: SearchResult, detail: CardDetail | undefined, query: SourceQuery): RawListing | null {
  const rentalId = result.rental_id;
  const name = result.display_name;
  if (!rentalId || !name || !result.slug) return null;

  const priced = priceFor(result.prices ?? {}, query.bedrooms);
  if (!priced) return null;
  if (priced.price < query.minRent || priced.price > query.maxRent) return null;

  const updated = detail?.updated_at ? Date.parse(detail.updated_at) : NaN;

  return {
    sourceId: 'apartmentlist',
    sourceName: 'ApartmentList',
    externalId: rentalId,
    title: name,
    description: describe(detail),
    price: priced.price,
    bedrooms: priced.bedrooms,
    bathrooms: null,
    sqft: null,
    address: detail?.formatted_address ?? '',
    city: 'San Francisco',
    lat: result.lat ?? null,
    lng: result.lon ?? null,
    url: `${ORIGIN}${result.slug}`,
    imageUrl: photoUrl(detail),
    photoCount: detail?.all_photos?.length ?? 0,
    postedAt: Number.isNaN(updated) ? null : updated,
    contactEmail: null,
    contactPhone: detail?.phone ?? null,
    // Only the card subset carries address and photos; the rest are summaries
    // and must not be scored as if the landlord withheld that information.
    detail: detail ? 'full' : 'summary',
  };
}

export const apartmentListSource: ListingSource = {
  id: 'apartmentlist',
  name: 'ApartmentList',
  enabled: true,

  async fetchListings(query: SourceQuery): Promise<RawListing[]> {
    const response = await fetchWithTimeout(SEARCH_URL, 25_000);
    if (!response.ok) {
      throw new Error(`ApartmentList responded ${response.status}`);
    }

    const payload = flightPayload(await response.text());
    const results = objectsWith<SearchResult>(payload, ['rental_id', 'prices', 'slug']);
    const details = new Map<string, CardDetail>();
    for (const detail of objectsWith<CardDetail>(payload, ['rental_id', 'formatted_address', 'phone'])) {
      if (detail.rental_id) details.set(detail.rental_id, detail);
    }

    const listings: RawListing[] = [];
    const seen = new Set<string>();
    for (const result of results) {
      const listing = toListing(result, details.get(result.rental_id ?? ''), query);
      if (!listing || seen.has(listing.externalId)) continue;
      seen.add(listing.externalId);
      listings.push(listing);
      if (listings.length >= query.limit) break;
    }

    if (listings.length === 0 && results.length === 0) {
      throw new Error('ApartmentList returned no parseable listings — the page markup likely changed.');
    }

    return listings;
  },
};
