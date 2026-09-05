import { config } from './config.js';
import { absorb, duplicateKey } from './dedupe.js';
import { inventorySize, inventoryByKeys, queryInventory } from './inventory.js';
import { allowedByRules, getHouseRules } from './rules.js';
import { SOURCES, scoreAll, type ScoredListing, type SourceStatus } from './scoring.js';
import type { RawListing, SourceQuery } from './sources/types.js';

export { fillMissingFacts, type ScoredListing, type SourceStatus } from './scoring.js';

export interface ListingsQuery extends SourceQuery {
  /** Collapse the same unit advertised on several sites into one card. */
  dedupe: boolean;
}

export interface ListingsResponse {
  listings: ScoredListing[];
  sources: SourceStatus[];
  fetchedAt: number;
}

const cache = new Map<string, ListingsResponse>();
/** Filter combinations are unbounded, so the cache must not be. */
const MAX_CACHE_ENTRIES = 64;
/** Escalations to Claude per search; the rest fall back to the heuristics. */
const CLAUDE_REVIEWS_PER_SEARCH = 12;

function cacheKey(query: SourceQuery): string {
  return `${query.minRent}:${query.maxRent}:${query.minBedrooms}:${query.maxBedrooms}:${query.limit}`;
}

/**
 * Rules and de-duplication as one predicate so the page fills to `limit` with
 * listings the reader will actually see, rather than the limit being spent on
 * rows that are then dropped.
 */
function gate(query: ListingsQuery): (listing: ScoredListing) => boolean {
  const { rules } = getHouseRules();
  const kept = new Map<string, ScoredListing>();

  return (listing) => {
    if (!allowedByRules(listing, rules)) return false;
    if (!query.dedupe) return true;

    const key = duplicateKey(listing);
    const twin = kept.get(key);
    if (twin) {
      absorb(twin, listing);
      return false;
    }
    kept.set(key, listing);
    return true;
  };
}

/**
 * Searches read the nightly crawl, so they see the whole city instead of the
 * one truncated page a source returns per request. Fetching live is the
 * fallback for a server whose first crawl has not landed yet.
 */
export async function getListings(query: ListingsQuery): Promise<ListingsResponse> {
  // The group's standing rules are enforced here rather than per caller, so
  // browsing, Claude and alerts cannot each forget them separately. Saved
  // listings are looked up by key and stay readable whatever the rules say.
  const keep = gate(query);

  if (inventorySize() > 0) {
    return { listings: queryInventory(query, keep), sources: [], fetchedAt: Date.now() };
  }
  const live = await fetchLive(query);
  // Copies, because absorbing into a cached listing would leave "also on" links
  // on it for later searches that asked to see every site's copy.
  return { ...live, listings: live.listings.map((listing) => ({ ...listing })).filter(keep) };
}

async function fetchLive(query: SourceQuery): Promise<ListingsResponse> {
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
      if (!source.enabled) return [] as RawListing[];
      return source.fetchListings(query);
    }),
  );

  settled.forEach((result, index) => {
    const source = SOURCES[index];
    const fulfilled = result.status === 'fulfilled';
    if (fulfilled) raw.push(...result.value);
    statuses.push({
      id: source.id,
      name: source.name,
      enabled: source.enabled,
      count: fulfilled ? result.value.length : 0,
      error: fulfilled
        ? null
        : result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    });
  });

  const listings = await scoreAll(raw, CLAUDE_REVIEWS_PER_SEARCH);

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

/** Widest search the sources allow, so a key from any filter combination resolves. */
const EVERYTHING: ListingsQuery = {
  minRent: 0,
  maxRent: 100_000,
  minBedrooms: null,
  maxBedrooms: null,
  limit: 120,
  dedupe: false,
};

export async function findListings(keys: string[]): Promise<ScoredListing[]> {
  if (keys.length === 0) return [];
  const wanted = new Set(keys);

  const stored = inventoryByKeys(keys);
  if (stored.length === wanted.size) return stored;

  for (const response of cache.values()) {
    const hits = response.listings.filter((listing) => wanted.has(listing.key));
    if (hits.length === wanted.size) return hits;
  }

  const { listings } = await fetchLive(EVERYTHING);
  return [...stored, ...listings.filter((listing) => wanted.has(listing.key) && !stored.some((s) => s.key === listing.key))];
}
