import type { ScoredListing } from './scoring.js';

/**
 * The same unit is advertised on several sites at once, so a third of the store
 * is repeats of something already on screen. Two postings are the same unit only
 * when the building, the unit designation, the bedroom count and the rent all
 * agree: a building lists #309 and #310 at different rents, and a stale price on
 * one site is not a reason to hide the cheaper posting.
 */

/** "1234 Market St #5, San Francisco, CA 94103" and "1234 market street" match. */
function building(address: string): string {
  return address
    .toLowerCase()
    .split(',')[0]
    .replace(/(?:#|\b(?:apt|unit|suite|ste)\b\.?)\s*[\w-]+/g, ' ')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unit(address: string): string {
  return /(?:#|\b(?:apt|unit|suite|ste)\b\.?)\s*([\w-]+)/i.exec(address)?.[1].toLowerCase() ?? '';
}

/**
 * Coordinates stand in for a withheld address (ApartmentList publishes none for
 * a fifth of its listings). Rounding to four decimals is roughly 11m, so it
 * cannot merge neighbours, and it is never used to join two known addresses:
 * 1049 and 1053 Post St share a pin but are different buildings.
 */
function place(listing: ScoredListing): string | null {
  const named = building(listing.address);
  if (named) return named;
  if (listing.lat === null || listing.lng === null) return null;
  return `@${listing.lat.toFixed(4)},${listing.lng.toFixed(4)}`;
}

/**
 * Equal keys mean the same unit. A listing we cannot place at all gets a key of
 * its own, so "no address" never becomes the thing they have in common.
 */
export function duplicateKey(listing: ScoredListing): string {
  const where = place(listing);
  if (where === null) return `unplaceable|${listing.key}`;
  return `${where}|${listing.bedrooms ?? '?'}|${unit(listing.address)}|${listing.price}`;
}

/**
 * Folds `duplicate` into `primary` in place: the card keeps the other sites so
 * the group can check both postings, and takes any fact the first source left
 * blank rather than the reader losing it to the collapse.
 */
export function absorb(primary: ScoredListing, duplicate: ScoredListing): void {
  // One site advertising the same unit twice needs no "also on itself" link.
  if (duplicate.sourceId === primary.sourceId) return;
  primary.alsoOn ??= [];
  if (primary.alsoOn.some((other) => other.sourceId === duplicate.sourceId)) return;
  primary.alsoOn.push({
    sourceId: duplicate.sourceId,
    sourceName: duplicate.sourceName,
    url: duplicate.url,
  });

  primary.bathrooms ??= duplicate.bathrooms;
  primary.sqft ??= duplicate.sqft;
  if (primary.imageUrls.length === 0 && duplicate.imageUrls.length > 0) {
    primary.imageUrls = duplicate.imageUrls;
    primary.imageUrl ??= duplicate.imageUrl;
    primary.photoCount = duplicate.photoCount;
  }
  if (!primary.description && duplicate.description) primary.description = duplicate.description;
  if (!primary.address && duplicate.address) primary.address = duplicate.address;
}
