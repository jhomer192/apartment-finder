import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    token_hash   TEXT PRIMARY KEY,
    email        TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    redeemed_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    email        TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

  CREATE TABLE IF NOT EXISTS scam_assessments (
    listing_key  TEXT PRIMARY KEY,
    score        INTEGER NOT NULL,
    band         TEXT NOT NULL,
    reasons      TEXT NOT NULL,
    assessed_at  INTEGER NOT NULL
  );

  -- The snapshot is the point: a shortlisted place stays readable after the
  -- source delists it, which is exactly when the group is still discussing it.
  CREATE TABLE IF NOT EXISTS saved_listings (
    listing_key  TEXT PRIMARY KEY,
    snapshot     TEXT NOT NULL,
    saved_by     TEXT NOT NULL,
    saved_at     INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'saved',
    status_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS listing_notes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_key  TEXT NOT NULL REFERENCES saved_listings(listing_key) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    body         TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_notes_listing ON listing_notes(listing_key);
`);

export function purgeExpired(now = Date.now()): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM invites WHERE expires_at < ? AND redeemed_at IS NULL').run(now);
}
