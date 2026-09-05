import { getMetroById } from '../src/data/metros.js';
import { areaFactsFor, type AreaFacts } from './area.js';
import {
  assessListing,
  crossListingSignals,
  listingKey,
  mergeAssessments,
  normalizeAddress,
  type ClaudeBudget,
  type ScamAssessment,
} from './scam.js';
import { apartmentListSource } from './sources/apartmentlist.js';
import { craigslistSource } from './sources/craigslist.js';
import { redfinSource } from './sources/redfin.js';
import { rentSource } from './sources/rent.js';
import type { ListingSource, RawListing } from './sources/types.js';
import { zumperSource } from './sources/zumper.js';

export const SOURCES: ListingSource[] = [
  redfinSource,
  apartmentListSource,
  zumperSource,
  rentSource,
  craigslistSource,
];

export interface ScoredListing extends RawListing {
  key: string;
  neighborhood: string;
  scam: ScamAssessment;
  /** Null when the listing has no coordinates or the civic feeds are unreachable. */
  area: AreaFacts | null;
}

export interface SourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  count: number;
  error: string | null;
}

const BAY_AREA = getMetroById('bay-area');

export function nearestNeighborhood(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null || !BAY_AREA) return 'Unknown';
  let best = 'Unknown';
  let bestDistance = Infinity;
  for (const hood of BAY_AREA.neighborhoods) {
    const distance = (hood.lat - lat) ** 2 + (hood.lng - lng) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hood.name;
    }
  }
  return best;
}

/**
 * One source often omits the bathroom count or floor area another publishes for
 * the same building, so a listing borrows those from a same-address, same-size
 * listing rather than showing "— ba". Price is never borrowed: that is the
 * number the two sources are allowed to disagree on.
 */
export function fillMissingFacts(listings: RawListing[]): void {
  const byBuilding = new Map<string, RawListing[]>();
  for (const listing of listings) {
    const address = normalizeAddress(listing.address);
    if (!address) continue;
    const key = `${address}|${listing.bedrooms ?? '?'}`;
    byBuilding.set(key, [...(byBuilding.get(key) ?? []), listing]);
  }

  for (const group of byBuilding.values()) {
    const withBathrooms = group.find((listing) => listing.bathrooms !== null);
    const withSqft = group.find((listing) => listing.sqft !== null);
    for (const listing of group) {
      if (listing.bathrooms === null && withBathrooms) {
        listing.bathrooms = withBathrooms.bathrooms;
        listing.factsFrom = withBathrooms.sourceName;
      }
      if (listing.sqft === null && withSqft) {
        listing.sqft = withSqft.sqft;
        listing.factsFrom = withSqft.sourceName;
      }
    }
  }
}

/** Fills in the facts one source withheld, then scores and locates every listing. */
export async function scoreAll(raw: RawListing[], claudeReviews: number): Promise<ScoredListing[]> {
  fillMissingFacts(raw);

  const budget: ClaudeBudget = { remaining: claudeReviews };
  const duplicates = crossListingSignals(raw);

  return Promise.all(
    raw.map(async (listing) => {
      const id = listingKey(listing);
      return {
        ...listing,
        key: id,
        neighborhood: nearestNeighborhood(listing.lat, listing.lng),
        scam: mergeAssessments(await assessListing(listing, budget), duplicates.get(id)),
        area: await areaFactsFor(listing.lat, listing.lng),
      };
    }),
  );
}
