import { db } from './db.js';
import { scoreAll, SOURCES, type ScoredListing, type SourceStatus } from './scoring.js';
import type { RawListing, SourceQuery } from './sources/types.js';

/**
 * A search hits this table rather than the sources: SF has far more rentals
 * than any one source response returns, so the full set is crawled nightly and
 * kept here instead of being refetched, and truncated, per search.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    listing_key   TEXT PRIMARY KEY,
    source_id     TEXT NOT NULL,
    price         INTEGER NOT NULL,
    bedrooms      INTEGER,
    scam_score    INTEGER NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at  INTEGER NOT NULL,
    payload       TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_price ON inventory(price);

  CREATE TABLE IF NOT EXISTS inventory_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  INTEGER NOT NULL,
    finished_at INTEGER,
    listings    INTEGER NOT NULL DEFAULT 0,
    sources     TEXT NOT NULL DEFAULT '[]',
    error       TEXT
  );
`);

/** A listing missing from this many consecutive crawls has been taken down. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Escalations to Claude per crawl; the rest keep their heuristic score. */
const CLAUDE_REVIEWS_PER_CRAWL = 40;

export interface RefreshResult {
  listings: number;
  sources: SourceStatus[];
  startedAt: number;
  finishedAt: number;
}

export interface InventoryStatus {
  listings: number;
  /** Null until the first crawl finishes. */
  refreshedAt: number | null;
  refreshing: boolean;
  sources: SourceStatus[];
  error: string | null;
}

/** Crawling twice at once would double the load on the sources for nothing. */
let inFlight: Promise<RefreshResult> | null = null;

/** Exported for the crawl and its tests; a search never writes. */
export function storeListings(listings: ScoredListing[], now: number): void {
  const statement = db.prepare(
    `INSERT INTO inventory
       (listing_key, source_id, price, bedrooms, scam_score, first_seen_at, last_seen_at, payload)
     VALUES (@key, @sourceId, @price, @bedrooms, @scamScore, @now, @now, @payload)
     ON CONFLICT(listing_key) DO UPDATE SET
       price = excluded.price, bedrooms = excluded.bedrooms, scam_score = excluded.scam_score,
       last_seen_at = excluded.last_seen_at, payload = excluded.payload`,
  );

  db.transaction(() => {
    for (const listing of listings) {
      statement.run({
        key: listing.key,
        sourceId: listing.sourceId,
        price: listing.price,
        bedrooms: listing.bedrooms,
        scamScore: listing.scam.score,
        now,
        payload: JSON.stringify(listing),
      });
    }
  })();
}

async function crawlSources(): Promise<{ raw: RawListing[]; sources: SourceStatus[] }> {
  const raw: RawListing[] = [];
  const sources: SourceStatus[] = [];

  // Sequential: a crawl is not latency-sensitive, and hammering both sources at
  // once is how a scraper gets itself blocked.
  for (const source of SOURCES) {
    if (!source.enabled) {
      sources.push({ id: source.id, name: source.name, enabled: false, count: 0, error: null });
      continue;
    }

    try {
      const listings = source.fetchAll
        ? await source.fetchAll()
        : await source.fetchListings(EVERYTHING);
      raw.push(...listings);
      sources.push({ id: source.id, name: source.name, enabled: true, count: listings.length, error: null });
    } catch (error) {
      sources.push({
        id: source.id,
        name: source.name,
        enabled: true,
        count: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { raw, sources };
}

export function refreshInventory(): Promise<RefreshResult> {
  if (inFlight) return inFlight;

  const startedAt = Date.now();
  const run = db
    .prepare('INSERT INTO inventory_runs (started_at) VALUES (?)')
    .run(startedAt).lastInsertRowid;

  inFlight = (async () => {
    try {
      const { raw, sources } = await crawlSources();
      const listings = await scoreAll(raw, CLAUDE_REVIEWS_PER_CRAWL);
      const finishedAt = Date.now();
      storeListings(listings, finishedAt);

      // Only prune when a source answered: a night where everything 403s must
      // not empty the app.
      if (sources.some((source) => source.count > 0)) {
        db.prepare('DELETE FROM inventory WHERE last_seen_at < ?').run(finishedAt - STALE_AFTER_MS);
      }

      db.prepare('UPDATE inventory_runs SET finished_at = ?, listings = ?, sources = ? WHERE id = ?').run(
        finishedAt,
        listings.length,
        JSON.stringify(sources),
        run,
      );
      return { listings: listings.length, sources, startedAt, finishedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      db.prepare('UPDATE inventory_runs SET finished_at = ?, error = ? WHERE id = ?').run(
        Date.now(),
        message,
        run,
      );
      throw error;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

interface RunRow {
  finished_at: number | null;
  listings: number;
  sources: string;
  error: string | null;
}

export function inventoryStatus(): InventoryStatus {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM inventory').get() as { n: number }).n;
  const run = db
    .prepare('SELECT finished_at, listings, sources, error FROM inventory_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1')
    .get() as RunRow | undefined;

  return {
    listings: count,
    refreshedAt: run?.finished_at ?? null,
    refreshing: inFlight !== null,
    sources: run ? (JSON.parse(run.sources) as SourceStatus[]) : [],
    error: run?.error ?? null,
  };
}

export function inventorySize(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM inventory').get() as { n: number }).n;
}

/** Hour of the night the crawl runs, in the server's local time. */
const CRAWL_HOUR = 3;
/** A crawl older than this means the schedule missed a night. */
const STALE_CRAWL_MS = 36 * 60 * 60 * 1000;

export function msUntilNextCrawl(now: Date): number {
  const next = new Date(now);
  next.setHours(CRAWL_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function crawl(): void {
  refreshInventory()
    .then((result) => {
      console.log(`inventory: ${result.listings} listings in ${Math.round((result.finishedAt - result.startedAt) / 1000)}s`);
    })
    .catch((error: unknown) => {
      console.error('inventory refresh failed:', error instanceof Error ? error.message : error);
    });
}

/**
 * Nightly, plus once at boot when the stored set is empty or a night was
 * missed, so a restarted server is never serving week-old rentals.
 */
export function startCrawlSchedule(): void {
  const status = inventoryStatus();
  if (status.listings === 0 || status.refreshedAt === null || Date.now() - status.refreshedAt > STALE_CRAWL_MS) {
    setTimeout(crawl, 10_000).unref();
  }

  setTimeout(() => {
    crawl();
    setInterval(crawl, 24 * 60 * 60 * 1000).unref();
  }, msUntilNextCrawl(new Date())).unref();
}

/** Widest search the sources allow, for sources with no crawl of their own. */
const EVERYTHING: SourceQuery = {
  minRent: 0,
  maxRent: 100_000,
  minBedrooms: null,
  maxBedrooms: null,
  limit: 350,
};

/**
 * `keep` runs on the parsed payload, so a filter on something the table has no
 * column for (a neighborhood, a house rule) still costs the caller its limit in
 * results rather than silently returning a short page.
 */
export function queryInventory(
  query: SourceQuery,
  keep: (listing: ScoredListing) => boolean = () => true,
): ScoredListing[] {
  const rows = db
    .prepare(
      `SELECT payload FROM inventory
       WHERE price BETWEEN @minRent AND @maxRent
         AND (@minBedrooms IS NULL OR bedrooms IS NULL OR bedrooms >= @minBedrooms)
         AND (@maxBedrooms IS NULL OR bedrooms IS NULL OR bedrooms <= @maxBedrooms)
       ORDER BY price ASC`,
    )
    .all({
      minRent: query.minRent,
      maxRent: query.maxRent,
      minBedrooms: query.minBedrooms,
      maxBedrooms: query.maxBedrooms,
    }) as Array<{ payload: string }>;

  const listings: ScoredListing[] = [];
  for (const row of rows) {
    if (listings.length >= query.limit) break;
    const listing = JSON.parse(row.payload) as ScoredListing;
    if (keep(listing)) listings.push(listing);
  }
  return listings;
}

export function inventoryByKeys(keys: string[]): ScoredListing[] {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT payload FROM inventory WHERE listing_key IN (${placeholders})`)
    .all(...keys) as Array<{ payload: string }>;
  return rows.map((row) => JSON.parse(row.payload) as ScoredListing);
}
