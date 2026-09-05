import { fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const SEARCH_URL = 'https://www.apartmentlist.com/ca/san-francisco';
const ORIGIN = 'https://www.apartmentlist.com';
const PHOTO_BASE = 'https://cdn.apartmentlist.com/image/upload/f_auto,q_auto,t_web-base';
const MAX_PHOTOS = 40;
/** Property pages fetched per search to fill in what the search page omits. */
const MAX_HYDRATED = 100;
const HYDRATE_CONCURRENCY = 8;
/** Stop hydrating rather than let the backfill dominate search latency. */
const HYDRATE_BUDGET_MS = 12_000;

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

function photoUrls(detail: CardDetail | undefined): string[] {
  const ids: string[] = [];
  for (const photo of detail?.all_photos ?? []) {
    const id = (photo as { id?: unknown }).id;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  const lead = detail?.first_photo?.[0]?.id;
  if (lead && !ids.includes(lead)) ids.unshift(lead);
  return ids.slice(0, MAX_PHOTOS).map((id) => `${PHOTO_BASE}/${id}.jpg`);
}

/**
 * A property page embeds its gallery as an `all_photos` array, either inline or
 * escaped inside a flight chunk string depending on how the page was rendered.
 */
function galleryFromPropertyPage(html: string): string[] {
  const match = /\\?"all_photos\\?":\s*\[/.exec(html);
  if (!match) return [];
  const open = html.indexOf('[', match.index);
  const end = html.indexOf(']', open);
  if (end === -1) return [];
  try {
    const array = JSON.parse(html.slice(open, end + 1).replace(/\\"/g, '"')) as unknown[];
    return photoUrls({ all_photos: array });
  } catch {
    return [];
  }
}

interface UnitFacts {
  bed: number;
  bath: number;
  sqft: number;
}

/**
 * The search page carries no floor-plan detail, but a property page lists every
 * available unit as `{"bed":2,"bath":1,"sqft":790,...}`, inline or escaped
 * inside a flight chunk.
 */
export function unitsFromPropertyPage(html: string): UnitFacts[] {
  const units: UnitFacts[] = [];
  for (const match of html.matchAll(/\\?"bed\\?":\s*(\d+),\\?"bath\\?":\s*(\d+(?:\.\d+)?),\\?"sqft\\?":\s*(\d+)/g)) {
    units.push({ bed: Number(match[1]), bath: Number(match[2]), sqft: Number(match[3]) });
  }
  return units;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/**
 * A property advertises several floor plans, so report the typical unit of the
 * size we priced rather than a mix of studios and three-beds.
 */
export function unitFacts(units: UnitFacts[], bedrooms: number): { bathrooms: number | null; sqft: number | null } {
  const matching = units.filter((unit) => unit.bed === bedrooms);
  return {
    bathrooms: median(matching.filter((unit) => unit.bath > 0).map((unit) => unit.bath)),
    sqft: median(matching.filter((unit) => unit.sqft > 0).map((unit) => unit.sqft)),
  };
}

/**
 * The search page only embeds photos for the properties it renders as cards,
 * and floor-plan detail for none of them. Both live on the property's own page,
 * so fetch a bounded number of those rather than showing "no photo" for a
 * property that has plenty, or "— ba" for one that publishes its bathrooms.
 */
async function hydrateFromPropertyPages(listings: RawListing[]): Promise<void> {
  const missing = listings
    .filter((listing) => listing.imageUrls.length === 0 || listing.bathrooms === null)
    .slice(0, MAX_HYDRATED);
  const deadline = Date.now() + HYDRATE_BUDGET_MS;

  for (let i = 0; i < missing.length && Date.now() < deadline; i += HYDRATE_CONCURRENCY) {
    await Promise.all(
      missing.slice(i, i + HYDRATE_CONCURRENCY).map(async (listing) => {
        try {
          const response = await fetchWithTimeout(listing.url, 10_000);
          if (!response.ok) return;
          const html = await response.text();

          const urls = galleryFromPropertyPage(html);
          if (urls.length > 0 && listing.imageUrls.length === 0) {
            listing.imageUrl = urls[0];
            listing.imageUrls = urls;
            listing.photoCount = Math.max(listing.photoCount, urls.length);
          }

          const facts = unitFacts(unitsFromPropertyPage(html), listing.bedrooms ?? 0);
          listing.bathrooms = listing.bathrooms ?? facts.bathrooms;
          listing.sqft = listing.sqft ?? facts.sqft;
        } catch {
          // A property without a reachable page just keeps what the search gave us.
        }
      }),
    );
  }
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
  const photos = photoUrls(detail);

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
    imageUrl: photos[0] ?? null,
    imageUrls: photos,
    photoCount: Math.max(detail?.all_photos?.length ?? 0, photos.length),
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

    await hydrateFromPropertyPages(listings);

    if (listings.length === 0 && results.length === 0) {
      throw new Error('ApartmentList returned no parseable listings — the page markup likely changed.');
    }

    return listings;
  },
};
