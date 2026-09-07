import { db } from './db.js';
import { getSaved, setStatus } from './shortlist.js';

export const CONTACT_CHANNELS = ['email', 'sms', 'call', 'site'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_OUTCOMES = ['sent', 'replied', 'tour-offered', 'declined', 'no-reply'] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export interface ContactEntry {
  id: number;
  listingKey: string;
  /** The roommate who reached out. */
  email: string;
  via: ContactChannel;
  outcome: ContactOutcome;
  note: string;
  contactedAt: number;
  updatedAt: number;
}

interface ContactRow {
  id: number;
  listing_key: string;
  email: string;
  via: ContactChannel;
  outcome: ContactOutcome;
  note: string;
  contacted_at: number;
  updated_at: number;
}

function toEntry(row: ContactRow): ContactEntry {
  return {
    id: row.id,
    listingKey: row.listing_key,
    email: row.email,
    via: row.via,
    outcome: row.outcome,
    note: row.note,
    contactedAt: row.contacted_at,
    updatedAt: row.updated_at,
  };
}

export function listContacts(): ContactEntry[] {
  const rows = db.prepare('SELECT * FROM listing_contacts ORDER BY contacted_at DESC').all() as ContactRow[];
  return rows.map(toEntry);
}

/**
 * Logging a contact also moves a saved listing from "saved" to "contacted";
 * the other statuses are further along and are left alone.
 */
export function logContact(key: string, email: string, via: ContactChannel, note: string): ContactEntry {
  const now = Date.now();
  const id = db
    .prepare(
      `INSERT INTO listing_contacts (listing_key, email, via, outcome, note, contacted_at, updated_at)
       VALUES (?, ?, ?, 'sent', ?, ?, ?)`,
    )
    .run(key, email, via, note, now, now).lastInsertRowid;

  if (getSaved(key)?.status === 'saved') setStatus(key, 'contacted');

  return { id: Number(id), listingKey: key, email, via, outcome: 'sent', note, contactedAt: now, updatedAt: now };
}

export function updateContact(
  id: number,
  changes: { outcome?: ContactOutcome; note?: string },
): ContactEntry | null {
  const row = db.prepare('SELECT * FROM listing_contacts WHERE id = ?').get(id) as ContactRow | undefined;
  if (!row) return null;

  const outcome = changes.outcome ?? row.outcome;
  const note = changes.note ?? row.note;
  const now = Date.now();
  db.prepare('UPDATE listing_contacts SET outcome = ?, note = ?, updated_at = ? WHERE id = ?').run(outcome, note, now, id);
  return toEntry({ ...row, outcome, note, updated_at: now });
}

/** Undoing the last logged contact also undoes the auto-promotion to "contacted". */
export function deleteContact(id: number): boolean {
  const row = db.prepare('SELECT listing_key FROM listing_contacts WHERE id = ?').get(id) as
    | { listing_key: string }
    | undefined;
  if (!row) return false;
  db.prepare('DELETE FROM listing_contacts WHERE id = ?').run(id);

  const remaining = db
    .prepare('SELECT COUNT(*) AS n FROM listing_contacts WHERE listing_key = ?')
    .get(row.listing_key) as { n: number };
  if (remaining.n === 0 && getSaved(row.listing_key)?.status === 'contacted') {
    setStatus(row.listing_key, 'saved');
  }
  return true;
}
