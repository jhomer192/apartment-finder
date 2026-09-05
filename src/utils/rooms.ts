import type { Listing, SearchParams } from '../types';

/**
 * Bathroom filtering happens in the browser because neither source accepts a
 * bath filter. Listings whose bath count nobody published cannot be shown to
 * satisfy a bound, so asking for one drops them rather than guessing.
 */
export function bathroomsInRange(bathrooms: number | null, params: SearchParams): boolean {
  if (params.minBathrooms === null && params.maxBathrooms === null) return true;
  if (bathrooms === null) return false;
  if (params.minBathrooms !== null && bathrooms < params.minBathrooms) return false;
  return params.maxBathrooms === null || bathrooms <= params.maxBathrooms;
}

/**
 * What one roommate pays if the group splits by bedroom, which is how a $6,000
 * four-bed beats a $3,000 one-bed. A studio counts as one bedroom: somebody
 * still pays the whole rent to live in it.
 */
export function pricePerBedroom(listing: Listing): number {
  return listing.price / Math.max(1, listing.bedrooms);
}
