import { db } from './db.js';

/** Distinct roommates who must thumbs-down a listing before it leaves everyone's feed. */
export const HIDE_AFTER = 3;

export interface DislikeSummary {
  /** Distinct voters per listing key; keys with no votes are absent. */
  counts: Record<string, number>;
  /** Listing keys the requesting roommate has disliked. */
  mine: string[];
  hideAfter: number;
}

interface VoteRow {
  listing_key: string;
  email: string;
}

export function addDislike(key: string, email: string): void {
  db.prepare(
    `INSERT INTO listing_dislikes (listing_key, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT(listing_key, email) DO NOTHING`,
  ).run(key, email, Date.now());
}

export function removeDislike(key: string, email: string): boolean {
  return (
    db.prepare('DELETE FROM listing_dislikes WHERE listing_key = ? AND email = ?').run(key, email)
      .changes > 0
  );
}

export function dislikeSummary(email: string): DislikeSummary {
  const rows = db.prepare('SELECT listing_key, email FROM listing_dislikes').all() as VoteRow[];
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const row of rows) {
    counts[row.listing_key] = (counts[row.listing_key] ?? 0) + 1;
    if (row.email === email) mine.push(row.listing_key);
  }
  return { counts, mine, hideAfter: HIDE_AFTER };
}

/** Keys the group has collectively ruled out; Claude and alerts skip these too. */
export function hiddenKeys(): Set<string> {
  const rows = db
    .prepare(
      'SELECT listing_key FROM listing_dislikes GROUP BY listing_key HAVING COUNT(DISTINCT email) >= ?',
    )
    .all(HIDE_AFTER) as Pick<VoteRow, 'listing_key'>[];
  return new Set(rows.map((row) => row.listing_key));
}
