import { getMetroById } from '../src/data/metros.js';
import { areaFactsFor, type AreaFacts } from './area.js';
import { config } from './config.js';
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
import type { ListingSource, RawListing, SourceQuery } from './sources/types.js';

const SOURCES: ListingSource[] = [redfinSource, apartmentListSource, craigslistSource];

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

export interface ListingsResponse {
  listings: ScoredListing[];
  sources: SourceStatus[];
  fetchedAt: number;
}

const BAY_AREA = getMetroById('bay-area');

function nearestNeighborhood(lat: number | null, lng: number | null): string {
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

const cache = new Map<string, ListingsResponse>();
/** Filter combinations are unbounded, so the cache must not be. */
const MAX_CACHE_ENTRIES = 64;
/** Escalations to Claude per search; the rest fall back to the heuristics. */
const CLAUDE_REVIEWS_PER_SEARCH = 12;

function cacheKey(query: SourceQuery): string {
  return `${query.minRent}:${query.maxRent}:${query.minBedrooms}:${query.maxBedrooms}:${query.limit}`;
}

export async function getListings(query: SourceQuery): Promise<ListingsResponse> {
  const key = cacheKey(query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < config.listingCacheMinutes * 60 * 1000) {
    return cached;
  }

  const statuses: SourceStatus[] = [];
  const raw: RawListing[] = [];

  // One dead source must not take down the whole search.
  const settled = await Promise.allSettled(
    SOURCES.map(async (source) => {
      if (!source.enabled) return { source, listings: [] as RawListing[], skipped: true };
      return { source, listings: await source.fetchListings(query), skipped: false };
    }),
  );

  settled.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === 'fulfilled') {
      raw.push(...result.value.listings);
      statuses.push({
        id: source.id,
        name: source.name,
        enabled: source.enabled,
        count: result.value.listings.length,
        error: null,
      });
    } else {
      statuses.push({
        id: source.id,
        name: source.name,
        enabled: source.enabled,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  fillMissingFacts(raw);

  const budget: ClaudeBudget = { remaining: CLAUDE_REVIEWS_PER_SEARCH };
  const duplicates = crossListingSignals(raw);
  const listings = await Promise.all(
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

  // Sorting by risk here would truncate away every listing worth warning about,
  // so the cut is on price and the client owns the ordering.
  listings.sort((a, b) => a.price - b.price);

  const response: ListingsResponse = {
    listings: listings.slice(0, query.limit),
    sources: statuses,
    fetchedAt: Date.now(),
  };
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, response);
  return response;
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

/** Widest search the sources allow, so a key from any filter combination resolves. */
const EVERYTHING: SourceQuery = {
  minRent: 0,
  maxRent: 100_000,
  minBedrooms: null,
  maxBedrooms: null,
  limit: 120,
};

export async function findListings(keys: string[]): Promise<ScoredListing[]> {
  if (keys.length === 0) return [];
  const wanted = new Set(keys);

  for (const response of cache.values()) {
    const hits = response.listings.filter((listing) => wanted.has(listing.key));
    if (hits.length === wanted.size) return hits;
  }

  const { listings } = await getListings(EVERYTHING);
  return listings.filter((listing) => wanted.has(listing.key));
}
