import { bedroomsInRange, fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const ORIGIN = 'https://www.rent.com';
const SEARCH_URL = `${ORIGIN}/california/san-francisco-apartments`;
const PHOTO_BASE = 'https://i.rent.com/t_3x2_fixed_webp_lg';
const PAGE_SIZE = 30;
/** SF lists ~500 properties; the cap keeps a shape change from crawling forever. */
const MAX_PAGES = 25;
/** Enough for a gallery without making a card pull down dozens of images. */
const MAX_PHOTOS = 40;

interface Photo {
  id?: string;
}

interface FloorPlan {
  bedCount?: number | null;
  bathCount?: number | null;
  priceRange?: { min?: number | null; max?: number | null };
  sqFtRange?: { min?: number | null; max?: number | null };
  photos?: Photo[];
}

interface Property {
  id?: string;
  name?: string;
  addressFull?: string;
  address?: string;
  urlPathname?: string;
  location?: { lat?: number; lng?: number };
  optimizedPhotos?: Photo[];
  floorPlans?: FloorPlan[];
  amenitiesHighlighted?: string[];
  uniqueHighlights?: string[];
  phoneDesktop?: string | null;
  updatedAt?: string | null;
}

interface SearchPage {
  properties: Property[];
  total: number | null;
}

function photoUrls(photos: Photo[] | undefined): string[] {
  const urls: string[] = [];
  for (const photo of photos ?? []) {
    if (photo.id) urls.push(`${PHOTO_BASE}/${photo.id}`);
    if (urls.length >= MAX_PHOTOS) break;
  }
  return urls;
}

/** Next.js ships the whole search result as JSON in the page it renders. */
export function propertiesFromSearchPage(html: string): SearchPage {
  const match = /id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('Rent.com page carried no __NEXT_DATA__ — the markup likely changed.');

  const data = JSON.parse(match[1]) as {
    props?: { pageProps?: { pageData?: { location?: { listingSearch?: { listings?: Property[]; total?: number } } } } };
  };
  const search = data.props?.pageProps?.pageData?.location?.listingSearch;
  return { properties: search?.listings ?? [], total: search?.total ?? null };
}

function describe(property: Property): string {
  return [...(property.amenitiesHighlighted ?? []), ...(property.uniqueHighlights ?? [])].join(', ');
}

/**
 * A property advertises one price per floor plan, so each distinct bed count
 * becomes its own listing: a 3-bed search must still find the building whose
 * cheapest unit is a studio.
 */
export function listingsFromProperty(property: Property): RawListing[] {
  const id = property.id;
  if (!id) return [];

  const cheapestPerSize = new Map<number, FloorPlan>();
  for (const plan of property.floorPlans ?? []) {
    const beds = plan.bedCount;
    const price = plan.priceRange?.min ?? plan.priceRange?.max;
    if (typeof beds !== 'number' || typeof price !== 'number' || price <= 0) continue;
    const best = cheapestPerSize.get(beds);
    const bestPrice = best?.priceRange?.min ?? best?.priceRange?.max ?? Infinity;
    if (price < bestPrice) cheapestPerSize.set(beds, plan);
  }

  const photos = photoUrls(property.optimizedPhotos);
  const updated = property.updatedAt ? Date.parse(property.updatedAt) : NaN;
  const listings: RawListing[] = [];

  for (const [beds, plan] of cheapestPerSize) {
    const price = plan.priceRange?.min ?? plan.priceRange?.max;
    if (typeof price !== 'number') continue;
    const planPhotos = photoUrls(plan.photos);
    const gallery = planPhotos.length > 0 ? planPhotos : photos;

    listings.push({
      sourceId: 'rentcom',
      sourceName: 'Rent.com',
      // One id per unit size, so the sizes of one property do not overwrite each other.
      externalId: `${id}-${beds}bd`,
      title: property.name ?? property.address ?? 'Rental listing',
      description: describe(property),
      price,
      bedrooms: beds,
      bathrooms: plan.bathCount ?? null,
      sqft: plan.sqFtRange?.min ?? plan.sqFtRange?.max ?? null,
      address: property.addressFull ?? property.address ?? '',
      city: 'San Francisco',
      lat: property.location?.lat ?? null,
      lng: property.location?.lng ?? null,
      url: property.urlPathname ? `${ORIGIN}${property.urlPathname}` : ORIGIN,
      imageUrl: gallery[0] ?? null,
      imageUrls: gallery,
      photoCount: gallery.length,
      postedAt: Number.isNaN(updated) ? null : updated,
      contactEmail: null,
      contactPhone: property.phoneDesktop ?? null,
      detail: 'full',
    });
  }

  return listings;
}

async function fetchPage(page: number): Promise<SearchPage> {
  const url = page === 1 ? SEARCH_URL : `${SEARCH_URL}?page=${page}`;
  const response = await fetchWithTimeout(url, 25_000);
  if (!response.ok) throw new Error(`Rent.com responded ${response.status}`);
  return propertiesFromSearchPage(await response.text());
}

async function crawl(maxPages: number): Promise<RawListing[]> {
  const found = new Map<string, RawListing>();
  let pages = maxPages;

  for (let page = 1; page <= pages; page += 1) {
    const { properties, total } = await fetchPage(page);
    for (const property of properties) {
      for (const listing of listingsFromProperty(property)) found.set(listing.externalId, listing);
    }
    if (total !== null) pages = Math.min(maxPages, Math.ceil(total / PAGE_SIZE));
    if (properties.length === 0) break;
  }

  return [...found.values()];
}

export const rentSource: ListingSource = {
  id: 'rentcom',
  name: 'Rent.com',
  enabled: true,

  async fetchAll(): Promise<RawListing[]> {
    const listings = await crawl(MAX_PAGES);
    if (listings.length === 0) {
      throw new Error('Rent.com returned no parseable listings — the page markup likely changed.');
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
