import { z } from 'zod';
import { db } from './db.js';

/**
 * Named searches the group runs again and again ("3 bd under $6k, not too far
 * from a train"). Shared like the shortlist and the house rules, so a check one
 * roommate works out is a check everybody can run.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_filters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    filter     TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const room = z.number().int().min(0).max(8).nullable().default(null);

export const SORT_OPTIONS = [
  'price-asc',
  'price-desc',
  'scam-desc',
  'sqft-desc',
  'ppsqft',
  'ppbed',
  'scam',
  'transit',
  'incidents',
  'safety',
] as const;

export const filterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  minRent: z.number().int().min(0).max(100_000).default(0),
  maxRent: z.number().int().min(0).max(100_000).default(100_000),
  minBedrooms: room,
  maxBedrooms: room,
  minBathrooms: room,
  maxBathrooms: room,
  dedupe: z.boolean().default(true),
  neighborhoods: z.array(z.string().max(60)).max(40).default([]),
  sort: z.enum(SORT_OPTIONS).default('scam'),
});

export type SavedFilter = z.infer<typeof filterSchema>;

export interface StoredFilter extends SavedFilter {
  id: number;
  createdBy: string;
  createdAt: number;
}

interface FilterRow {
  id: number;
  name: string;
  filter: string;
  created_by: string;
  created_at: number;
}

/** A filter written by an older version is skipped rather than breaking the list. */
function parse(row: FilterRow): StoredFilter | null {
  const parsed = filterSchema.safeParse({
    ...(JSON.parse(row.filter) as object),
    name: row.name,
  });
  if (!parsed.success) return null;
  return { ...parsed.data, id: row.id, createdBy: row.created_by, createdAt: row.created_at };
}

export function listFilters(): StoredFilter[] {
  const rows = db
    .prepare('SELECT id, name, filter, created_by, created_at FROM saved_filters ORDER BY name COLLATE NOCASE')
    .all() as FilterRow[];
  return rows.map(parse).filter((filter): filter is StoredFilter => filter !== null);
}

/**
 * Saving under a name that already exists overwrites it, so tweaking a check
 * and saving it again is one entry rather than "3 bd" and "3 bd (2)".
 */
export function saveFilter(filter: SavedFilter, email: string, now = Date.now()): StoredFilter {
  const { name, ...rest } = filter;
  const row = db
    .prepare(
      `INSERT INTO saved_filters (name, filter, created_by, created_at)
       VALUES (@name, @filter, @email, @now)
       ON CONFLICT(name) DO UPDATE SET filter = @filter, created_by = @email, created_at = @now
       RETURNING id, name, filter, created_by, created_at`,
    )
    .get({ name, filter: JSON.stringify(rest), email, now }) as FilterRow;

  return { ...filter, id: row.id, createdBy: row.created_by, createdAt: row.created_at };
}

export function deleteFilter(id: number): boolean {
  return db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id).changes > 0;
}
