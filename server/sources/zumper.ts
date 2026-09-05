import { BROWSER_HEADERS, bedroomsInRange, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const ORIGIN = 'https://www.zumper.com';
const LISTABLES_URL = `${ORIGIN}/api/t/1/pages/listables`;
/** Zumper answers with the whole page of results the map would draw. */
const PAGE_SIZE = 100;
/** SF holds ~600 listings; the cap stops a runaway crawl if that changes. */
const MAX_PAGES = 20;
const SF = { lat: 37.7749, lng: -122.4194, zoom: 12 };

interface Listable {
  listing_id?: number;
  address?: string;
  building_name?: string | null;
  neighborhood_name?: string | null;
  short_description?: string | null;
  lat?: number;
  lng?: number;
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  min_bathrooms?: number | null;
  phone?: string | null;
  url?: string | null;
  listed_on?: number | null;
  is_pad?: boolean;
}

async function fetchPage(offset: number): Promise<Listable[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(LISTABLES_URL, {
      method: 'POST',
      headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        external_id: null,
        long: SF.lng,
        lat: SF.lat,
        zoom: SF.zoom,
        url: '/apartments-for-rent/san-francisco-ca',
        filter: { status: ['active'] },
        limit: PAGE_SIZE,
        offset,
      }),
    });
    if (!response.ok) throw new Error(`Zumper responded ${response.status}`);
    const body = (await response.json()) as { listables?: Listable[] };
    return body.listables ?? [];
  } finally {
    clearTimeout(timer);
  }
}

function toListing(listable: Listable): RawListing | null {
  const id = listable.listing_id;
  const price = listable.min_price ?? listable.max_price;
  if (!id || !price) return null;

  const address = listable.address ?? '';
  return {
    sourceId: 'zumper',
    sourceName: 'Zumper',
    externalId: String(id),
    title: listable.building_name || address || 'Rental listing',
    description: listable.short_description ?? '',
    price,
    bedrooms: listable.min_bedrooms ?? null,
    bathrooms: listable.min_bathrooms ?? null,
    sqft: null,
    address,
    city: 'San Francisco',
    lat: listable.lat ?? null,
    lng: listable.lng ?? null,
    url: listable.url ? `${ORIGIN}${listable.url}` : `${ORIGIN}/listings/${id}`,
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: listable.listed_on ? listable.listed_on * 1000 : null,
    contactEmail: null,
    contactPhone: listable.phone ?? null,
    // Zumper's feed exposes photo ids but no addressable image URLs, so a
    // listing without pictures here says nothing about the landlord.
    detail: 'summary',
  };
}

async function crawl(pages: number): Promise<RawListing[]> {
  const found = new Map<string, RawListing>();

  for (let page = 0; page < pages; page += 1) {
    const listables = await fetchPage(page * PAGE_SIZE);
    for (const listable of listables) {
      const listing = toListing(listable);
      if (listing) found.set(listing.externalId, listing);
    }
    if (listables.length < PAGE_SIZE) break;
  }

  return [...found.values()];
}

export const zumperSource: ListingSource = {
  id: 'zumper',
  name: 'Zumper',
  enabled: true,

  async fetchAll(): Promise<RawListing[]> {
    const listings = await crawl(MAX_PAGES);
    if (listings.length === 0) {
      throw new Error('Zumper returned no parseable listings — the feed shape likely changed.');
    }
    return listings;
  },

  async fetchListings(query: SourceQuery): Promise<RawListing[]> {
    const listings: RawListing[] = [];
    for (const listing of await crawl(1)) {
      if (listing.price < query.minRent || listing.price > query.maxRent) continue;
      if (!bedroomsInRange(listing.bedrooms, query)) continue;
      listings.push(listing);
      if (listings.length >= query.limit) break;
    }
    return listings;
  },
};
