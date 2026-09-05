import { leasingEmail } from '../contact-info.js';
import { fetchWithTimeout, type ListingSource, type RawListing, type SourceQuery } from './types.js';

const SF_REGION_ID = 17151;
const SEARCH_URL = 'https://www.redfin.com/stingray/api/v1/search/rentals';
const PHOTO_BASE = 'https://ssl.cdn-redfin.com/photo/rent';
/** Enough for a gallery without making a card pull down dozens of images. */
const MAX_PHOTOS = 12;

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

export const redfinSource: ListingSource = {
  id: 'redfin',
  name: 'Redfin',
  enabled: true,

  async fetchListings(query: SourceQuery): Promise<RawListing[]> {
    const params = new URLSearchParams({
      al: '1',
      market: 'sanfrancisco',
      num_homes: String(Math.min(query.limit * 4, 350)),
      region_id: String(SF_REGION_ID),
      region_type: '6',
    });

    const response = await fetchWithTimeout(`${SEARCH_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`Redfin responded ${response.status}`);
    }

    const body = (await response.json()) as { homes?: RedfinHome[] };
    const listings: RawListing[] = [];

    for (const home of body.homes ?? []) {
      const listing = toListing(home);
      if (!listing) continue;
      if (listing.price < query.minRent || listing.price > query.maxRent) continue;
      if (query.bedrooms !== null && listing.bedrooms !== null && listing.bedrooms !== query.bedrooms) {
        continue;
      }
      listings.push(listing);
      if (listings.length >= query.limit) break;
    }

    return listings;
  },
};
