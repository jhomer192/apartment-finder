import { leasingEmail } from '../contact-info.js';
import { bedroomsInRange, fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const SF_REGION_ID = 17151;
const SEARCH_URL = 'https://www.redfin.com/stingray/api/v1/search/rentals';
const PHOTO_BASE = 'https://ssl.cdn-redfin.com/photo/rent';
/** The API truncates at this many homes however many are asked for. */
const RESULT_CAP = 350;
/** Stops a pathological split from crawling Redfin all night. */
const MAX_BAND_REQUESTS = 40;
/** Below this width a band holds one price point and splitting cannot help. */
const MIN_BAND_WIDTH = 100;
const TOP_RENT = 100_000;
/** Enough for a gallery without making a card pull down dozens of images. */
const MAX_PHOTOS = 40;

interface Range {
  min?: number;
  max?: number;
}

interface RedfinHome {
  homeData?: {
    propertyId?: string;
    url?: string;
    photosInfo?: { photoRanges?: Array<{ startPos: number; endPos: number; version: string }> };
    addressInfo?: {
      formattedStreetLine?: string;
      city?: string;
      state?: string;
      zip?: string;
      centroid?: { centroid?: { latitude?: number; longitude?: number } };
    };
  };
  rentalExtension?: {
    rentalId?: string;
    propertyName?: string;
    description?: string;
    bedRange?: Range;
    bathRange?: Range;
    sqftRange?: Range;
    rentPriceRange?: Range;
    lastUpdated?: string;
    mlsAgentEmail?: string;
    desktopPhone?: string;
    feedOriginalSource?: string;
  };
}

/**
 * Photos are addressed by position plus the version of the range they fall in,
 * e.g. the first photo of a range tagged version "3" is `0_3.jpg`.
 */
function photoUrls(rentalId: string, ranges: Array<{ startPos: number; endPos: number; version: string }>): string[] {
  const urls: string[] = [];
  for (const range of [...ranges].sort((a, b) => a.startPos - b.startPos)) {
    for (let pos = range.startPos; pos <= range.endPos && urls.length < MAX_PHOTOS; pos += 1) {
      urls.push(`${PHOTO_BASE}/${rentalId}/bigphoto/${pos}_${range.version}.jpg`);
    }
  }
  return urls;
}

function countPhotos(ranges: Array<{ endPos: number }>): number {
  if (ranges.length === 0) return 0;
  return Math.max(...ranges.map((range) => range.endPos)) + 1;
}

function midpoint(range: Range | undefined): number | null {
  if (!range) return null;
  const { min, max } = range;
  if (typeof min === 'number' && typeof max === 'number') return Math.round((min + max) / 2);
  return min ?? max ?? null;
}

function toListing(home: RedfinHome): RawListing | null {
  const data = home.homeData;
  const rental = home.rentalExtension;
  const rentalId = rental?.rentalId;
  const price = rental?.rentPriceRange?.min ?? rental?.rentPriceRange?.max;
  if (!data || !rental || !rentalId || !price) return null;

  const address = data.addressInfo;
  const ranges = data.photosInfo?.photoRanges ?? [];
  const photos = photoUrls(rentalId, ranges);
  const posted = rental.lastUpdated ? Date.parse(rental.lastUpdated) : NaN;

  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: rentalId,
    title: rental.propertyName ?? address?.formattedStreetLine ?? 'Rental listing',
    description: rental.description ?? '',
    price,
    bedrooms: midpoint(rental.bedRange),
    bathrooms: midpoint(rental.bathRange),
    sqft: midpoint(rental.sqftRange),
    address: address?.formattedStreetLine ?? '',
    city: address?.city ?? 'San Francisco',
    lat: address?.centroid?.centroid?.latitude ?? null,
    lng: address?.centroid?.centroid?.longitude ?? null,
    url: data.url ? `https://www.redfin.com${data.url}` : `https://www.redfin.com/rent/${rentalId}`,
    imageUrl: photos[0] ?? null,
    imageUrls: photos,
    photoCount: countPhotos(ranges),
    postedAt: Number.isNaN(posted) ? null : posted,
    contactEmail: leasingEmail(rental.mlsAgentEmail),
    contactPhone: rental.desktopPhone ?? null,
    detail: 'full',
  };
}

interface SearchResponse {
  homes: RedfinHome[];
  /** How many the filter actually matched, which exceeds what is returned. */
  matched: number;
}

async function searchHomes(params: URLSearchParams): Promise<SearchResponse> {
  const response = await fetchWithTimeout(`${SEARCH_URL}?${params}`);
  if (!response.ok) throw new Error(`Redfin responded ${response.status}`);
  const body = (await response.json()) as { homes?: RedfinHome[]; numMatchedHomes?: number };
  const homes = body.homes ?? [];
  return { homes, matched: body.numMatchedHomes ?? homes.length };
}

function searchParams(numHomes: number, band?: { min: number; max: number }): URLSearchParams {
  const params = new URLSearchParams({
    al: '1',
    market: 'sanfrancisco',
    num_homes: String(numHomes),
    region_id: String(SF_REGION_ID),
    region_type: '6',
  });
  if (band) {
    params.set('min_price', String(band.min));
    params.set('max_price', String(band.max));
  }
  return params;
}

/**
 * SF has more rentals than one response returns, so the crawl narrows the rent
 * filter until each slice fits under the cap. The response says how many the
 * filter matched, which is how a truncated slice is told from a complete one.
 */
async function crawlByPriceBand(): Promise<RawListing[]> {
  const found = new Map<string, RawListing>();
  const queue: Array<{ min: number; max: number }> = [{ min: 0, max: TOP_RENT }];
  let requests = 0;

  while (queue.length > 0 && requests < MAX_BAND_REQUESTS) {
    const band = queue.shift()!;
    requests += 1;
    const { homes, matched } = await searchHomes(searchParams(RESULT_CAP, band));

    for (const home of homes) {
      const listing = toListing(home);
      if (listing) found.set(listing.externalId, listing);
    }

    if (matched > homes.length && band.max - band.min > MIN_BAND_WIDTH) {
      const mid = Math.round((band.min + band.max) / 2);
      queue.push({ min: band.min, max: mid }, { min: mid + 1, max: band.max });
    }
  }

  return [...found.values()];
}

export const redfinSource: ListingSource = {
  id: 'redfin',
  name: 'Redfin',
  enabled: true,

  fetchAll: crawlByPriceBand,

  async fetchListings(query: SourceQuery): Promise<RawListing[]> {
    const { homes } = await searchHomes(searchParams(Math.min(query.limit * 4, RESULT_CAP)));
    const listings: RawListing[] = [];

    for (const home of homes) {
      const listing = toListing(home);
      if (!listing) continue;
      if (listing.price < query.minRent || listing.price > query.maxRent) continue;
      if (!bedroomsInRange(listing.bedrooms, query)) continue;
      listings.push(listing);
      if (listings.length >= query.limit) break;
    }

    return listings;
  },
};
