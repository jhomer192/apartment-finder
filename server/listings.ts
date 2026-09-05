import { getMetroById } from '../src/data/metros.js';
import { config } from './config.js';
import { assessListing, listingKey, type ClaudeBudget, type ScamAssessment } from './scam.js';
import { apartmentListSource } from './sources/apartmentlist.js';
import { craigslistSource } from './sources/craigslist.js';
import { redfinSource } from './sources/redfin.js';
import type { ListingSource, RawListing, SourceQuery } from './sources/types.js';

const SOURCES: ListingSource[] = [redfinSource, apartmentListSource, craigslistSource];

export interface ScoredListing extends RawListing {
  key: string;
  neighborhood: string;
  scam: ScamAssessment;
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
  return `${query.minRent}:${query.maxRent}:${query.bedrooms}:${query.limit}`;
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

  const budget: ClaudeBudget = { remaining: CLAUDE_REVIEWS_PER_SEARCH };
  const listings = await Promise.all(
    raw.map(async (listing) => ({
      ...listing,
      key: listingKey(listing),
      neighborhood: nearestNeighborhood(listing.lat, listing.lng),
      scam: await assessListing(listing, budget),
    })),
  );

  listings.sort((a, b) => a.scam.score - b.scam.score || a.price - b.price);

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

/** Widest search the sources allow, so a key from any filter combination resolves. */
const EVERYTHING: SourceQuery = { minRent: 0, maxRent: 100_000, bedrooms: null, limit: 120 };

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
