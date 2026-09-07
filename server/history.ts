import { db } from './db.js';
import type { SourceStatus } from './scoring.js';

export interface PricePoint {
  price: number;
  at: number;
}

export interface ListingHistory {
  /** When a crawl first stored this listing; the source's own posted date may be earlier. */
  firstSeenAt: number;
  lastSeenAt: number;
  /** Every price seen, oldest first; empty when the rent has never moved. */
  prices: PricePoint[];
}

/** Call inside the crawl's write transaction, once per stored listing. */
const lastPrice = db.prepare(
  'SELECT price FROM listing_prices WHERE listing_key = ? ORDER BY seen_at DESC LIMIT 1',
);
const insertPrice = db.prepare('INSERT INTO listing_prices (listing_key, price, seen_at) VALUES (?, ?, ?)');

export function recordPrice(key: string, price: number, now: number): void {
  const previous = lastPrice.get(key) as { price: number } | undefined;
  if (previous?.price === price) return;
  insertPrice.run(key, price, now);
}

interface PriceRow {
  listing_key: string;
  price: number;
  seen_at: number;
}

/** Price series for every listing whose rent has changed at least once. */
export function changedPrices(): Map<string, PricePoint[]> {
  const rows = db
    .prepare(
      `SELECT listing_key, price, seen_at FROM listing_prices
       WHERE listing_key IN (SELECT listing_key FROM listing_prices GROUP BY listing_key HAVING COUNT(*) > 1)
       ORDER BY listing_key, seen_at`,
    )
    .all() as PriceRow[];

  const series = new Map<string, PricePoint[]>();
  for (const row of rows) {
    const list = series.get(row.listing_key) ?? [];
    list.push({ price: row.price, at: row.seen_at });
    series.set(row.listing_key, list);
  }
  return series;
}

/** Current first/last seen and price series for listings still in inventory. */
export function historyFor(keys: string[]): Map<string, ListingHistory> {
  const result = new Map<string, ListingHistory>();
  if (keys.length === 0) return result;
  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT listing_key, first_seen_at, last_seen_at FROM inventory WHERE listing_key IN (${placeholders})`)
    .all(...keys) as { listing_key: string; first_seen_at: number; last_seen_at: number }[];
  const prices = db
    .prepare(`SELECT listing_key, price, seen_at FROM listing_prices WHERE listing_key IN (${placeholders}) ORDER BY seen_at`)
    .all(...keys) as PriceRow[];
  for (const row of rows) {
    result.set(row.listing_key, { firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, prices: [] });
  }
  for (const row of prices) {
    result.get(row.listing_key)?.prices.push({ price: row.price, at: row.seen_at });
  }
  return result;
}

/** Runs after the inventory prune, so history only outlives a listing on the shortlist snapshot. */
export function pruneHistory(): void {
  db.prepare('DELETE FROM listing_prices WHERE listing_key NOT IN (SELECT listing_key FROM inventory)').run();
}

export interface Availability {
  /** `gone` once a crawl that reached the listing's source no longer returned it. */
  status: 'listed' | 'gone' | 'unknown';
  lastSeenAt: number | null;
  /** What the source shows now; null once the listing is gone. */
  currentPrice: number | null;
}

interface StoredRow {
  listing_key: string;
  source_id: string;
  price: number;
  last_seen_at: number;
}

interface LatestRun {
  finished_at: number;
  sources: string;
}

export interface SavedRef {
  key: string;
  /** Sources rotate their listing ids; the page URL is the stable identity. */
  url: string;
}

const byUrl = db.prepare(
  `SELECT listing_key, source_id, price, last_seen_at FROM inventory
   WHERE json_extract(payload, '$.url') = ? ORDER BY last_seen_at DESC LIMIT 1`,
);

/**
 * Whether the places the group saved are still advertised. A source that
 * failed overnight leaves its listings `listed`: silence is not a delisting.
 */
export function availabilityFor(refs: SavedRef[]): Map<string, Availability> {
  const result = new Map<string, Availability>();
  if (refs.length === 0) return result;
  const keys = refs.map((ref) => ref.key);

  const run = db
    .prepare(
      `SELECT finished_at, sources FROM inventory_runs
       WHERE finished_at IS NOT NULL AND error IS NULL AND listings > 0
       ORDER BY finished_at DESC LIMIT 1`,
    )
    .get() as LatestRun | undefined;
  const reached = new Set(
    run ? (JSON.parse(run.sources) as SourceStatus[]).filter((s) => s.count > 0).map((s) => s.id) : [],
  );

  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT listing_key, source_id, price, last_seen_at FROM inventory WHERE listing_key IN (${placeholders})`)
    .all(...keys) as StoredRow[];
  const stored = new Map(rows.map((row) => [row.listing_key, row]));

  const missed = (row: StoredRow) =>
    run !== undefined && reached.has(row.source_id) && row.last_seen_at < run.finished_at;

  for (const { key, url } of refs) {
    let row = stored.get(key);
    if (!row || missed(row)) {
      const same = byUrl.get(url) as StoredRow | undefined;
      if (same && !missed(same)) row = same;
    }
    if (!row) {
      result.set(key, { status: run ? 'gone' : 'unknown', lastSeenAt: null, currentPrice: null });
      continue;
    }
    const gone = missed(row);
    result.set(key, {
      status: gone ? 'gone' : 'listed',
      lastSeenAt: row.last_seen_at,
      currentPrice: gone ? null : row.price,
    });
  }
  return result;
}
