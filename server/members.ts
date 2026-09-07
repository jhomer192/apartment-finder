import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';
import { createSession, isAllowed, setPassword } from './auth.js';
import { db } from './db.js';

/** A week: long enough to text around, short enough that a leaked link goes stale. */
const JOIN_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface Member {
  email: string;
  /** Empty for people on the configured allowlist. */
  invitedBy: string;
  joinedAt: number | null;
  /** Configured members can only be removed by editing the server config. */
  removable: boolean;
  isAdmin: boolean;
}

export interface JoinLink {
  id: number;
  createdBy: string;
  label: string;
  createdAt: number;
  expiresAt: number;
  claimedBy: string | null;
  claimedAt: number | null;
  revokedAt: number | null;
}

interface LinkRow {
  id: number;
  created_by: string;
  label: string;
  created_at: number;
  expires_at: number;
  claimed_by: string | null;
  claimed_at: number | null;
  revoked_at: number | null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toLink(row: LinkRow): JoinLink {
  return {
    id: row.id,
    createdBy: row.created_by,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    revokedAt: row.revoked_at,
  };
}

export function listMembers(): Member[] {
  const rows = db
    .prepare('SELECT email, invited_by, joined_at FROM members WHERE revoked_at IS NULL ORDER BY joined_at')
    .all() as { email: string; invited_by: string; joined_at: number }[];
  const configured: Member[] = config.allowedEmails.map((email) => ({
    email,
    invitedBy: '',
    joinedAt: null,
    removable: false,
    isAdmin: email === config.adminEmail,
  }));
  const joined: Member[] = rows
    .filter((row) => !config.allowedEmails.includes(row.email))
    .map((row) => ({ email: row.email, invitedBy: row.invited_by, joinedAt: row.joined_at, removable: true, isAdmin: false }));
  return [...configured, ...joined];
}

/** Ends every session too: the allowlist is re-checked on each request. */
export function removeMember(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (config.allowedEmails.includes(normalized)) return false;
  const changed = db
    .prepare('UPDATE members SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL')
    .run(Date.now(), normalized).changes;
  if (changed > 0) db.prepare('DELETE FROM sessions WHERE email = ?').run(normalized);
  return changed > 0;
}

export function createJoinLink(createdBy: string, label: string): { token: string; link: JoinLink } {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const info = db
    .prepare(
      'INSERT INTO join_links (token_hash, created_by, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(hashToken(token), createdBy, label, now, now + JOIN_LINK_TTL_MS);
  const row = db.prepare('SELECT * FROM join_links WHERE id = ?').get(info.lastInsertRowid) as LinkRow;
  return { token, link: toLink(row) };
}

export function listJoinLinks(): JoinLink[] {
  const rows = db
    .prepare('SELECT * FROM join_links WHERE revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 50')
    .all(Date.now()) as LinkRow[];
  return rows.map(toLink);
}

export function revokeJoinLink(id: number): boolean {
  return db.prepare('UPDATE join_links SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(Date.now(), id).changes > 0;
}

function openLink(token: string): LinkRow | null {
  const row = db.prepare('SELECT * FROM join_links WHERE token_hash = ?').get(hashToken(token)) as LinkRow | undefined;
  if (!row || row.revoked_at !== null || row.claimed_at !== null || row.expires_at < Date.now()) return null;
  return row;
}

/** What the join page shows before asking for anything: who sent it. */
export function previewJoinLink(token: string): { invitedBy: string; expiresAt: number } | null {
  const row = openLink(token);
  return row ? { invitedBy: row.created_by, expiresAt: row.expires_at } : null;
}

/**
 * Consumes the link, admits the address, sets the password, and signs them in.
 * Someone already in the group can use a link to (re)set their own password.
 */
export function claimJoinLink(
  token: string,
  email: string,
  password: string,
): { email: string; sessionToken: string } | null {
  const row = openLink(token);
  if (!row) return null;
  const normalized = email.trim().toLowerCase();
  const now = Date.now();

  db.transaction(() => {
    db.prepare('UPDATE join_links SET claimed_by = ?, claimed_at = ? WHERE id = ?').run(normalized, now, row.id);
    if (!isAllowed(normalized)) {
      db.prepare(
        `INSERT INTO members (email, invited_by, joined_at, revoked_at) VALUES (?, ?, ?, NULL)
         ON CONFLICT(email) DO UPDATE SET invited_by = excluded.invited_by, joined_at = excluded.joined_at, revoked_at = NULL`,
      ).run(normalized, row.created_by, now);
    }
    setPassword(normalized, password);
  })();

  return { email: normalized, sessionToken: createSession(normalized) };
}
