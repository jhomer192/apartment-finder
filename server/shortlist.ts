import { db } from './db.js';
import type { ScoredListing } from './listings.js';

export const SAVED_STATUSES = ['saved', 'contacted', 'touring', 'applied', 'passed'] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];

export interface ListingNote {
  id: number;
  email: string;
  body: string;
  createdAt: number;
}

export interface SavedListing {
  key: string;
  listing: ScoredListing;
  savedBy: string;
  savedAt: number;
  status: SavedStatus;
  statusAt: number;
  notes: ListingNote[];
}

interface SavedRow {
  listing_key: string;
  snapshot: string;
  saved_by: string;
  saved_at: number;
  status: SavedStatus;
  status_at: number;
}

interface NoteRow {
  id: number;
  listing_key: string;
  email: string;
  body: string;
  created_at: number;
}

function notesFor(keys: string[]): Map<string, ListingNote[]> {
  const notes = new Map<string, ListingNote[]>();
  if (keys.length === 0) return notes;

  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, listing_key, email, body, created_at FROM listing_notes
       WHERE listing_key IN (${placeholders}) ORDER BY created_at`,
    )
    .all(...keys) as NoteRow[];

  for (const row of rows) {
    const list = notes.get(row.listing_key) ?? [];
    list.push({ id: row.id, email: row.email, body: row.body, createdAt: row.created_at });
    notes.set(row.listing_key, list);
  }
  return notes;
}

function hydrate(rows: SavedRow[]): SavedListing[] {
  const notes = notesFor(rows.map((row) => row.listing_key));
  return rows.map((row) => ({
    key: row.listing_key,
    listing: JSON.parse(row.snapshot) as ScoredListing,
    savedBy: row.saved_by,
    savedAt: row.saved_at,
    status: row.status,
    statusAt: row.status_at,
    notes: notes.get(row.listing_key) ?? [],
  }));
}

export function listSaved(): SavedListing[] {
  const rows = db
    .prepare('SELECT * FROM saved_listings ORDER BY saved_at DESC')
    .all() as SavedRow[];
  return hydrate(rows);
}

export function getSaved(key: string): SavedListing | null {
  const row = db.prepare('SELECT * FROM saved_listings WHERE listing_key = ?').get(key) as
    | SavedRow
    | undefined;
  return row ? hydrate([row])[0] : null;
}

/** Re-saving refreshes the snapshot but keeps who saved it and the current status. */
export function save(listing: ScoredListing, email: string): SavedListing {
  const now = Date.now();
  db.prepare(
    `INSERT INTO saved_listings (listing_key, snapshot, saved_by, saved_at, status, status_at)
     VALUES (?, ?, ?, ?, 'saved', ?)
     ON CONFLICT(listing_key) DO UPDATE SET snapshot = excluded.snapshot`,
  ).run(listing.key, JSON.stringify(listing), email, now, now);
  return getSaved(listing.key) as SavedListing;
}

export function unsave(key: string): boolean {
  return db.prepare('DELETE FROM saved_listings WHERE listing_key = ?').run(key).changes > 0;
}

export function setStatus(key: string, status: SavedStatus): SavedListing | null {
  const changed = db
    .prepare('UPDATE saved_listings SET status = ?, status_at = ? WHERE listing_key = ?')
    .run(status, Date.now(), key).changes;
  return changed > 0 ? getSaved(key) : null;
}

export function addNote(key: string, email: string, body: string): ListingNote | null {
  if (!getSaved(key)) return null;
  const now = Date.now();
  const id = db
    .prepare('INSERT INTO listing_notes (listing_key, email, body, created_at) VALUES (?, ?, ?, ?)')
    .run(key, email, body, now).lastInsertRowid;
  return { id: Number(id), email, body, createdAt: now };
}
