import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { db } from './db.js';

export const SESSION_COOKIE = 'af_session';

export interface SessionUser {
  email: string;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/**
 * Tokens are stored only as hashes so a database leak cannot be replayed as a login.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isAllowed(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return config.allowedEmails.some((allowed) => {
    const a = Buffer.from(allowed);
    const b = Buffer.from(normalized);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function createInvite(email: string): { token: string; expiresAt: number } {
  const normalized = email.trim().toLowerCase();
  if (!isAllowed(normalized)) {
    throw new Error(`${normalized} is not in ALLOWED_EMAILS — add them there first.`);
  }
  const token = newToken();
  const now = Date.now();
  const expiresAt = now + config.inviteHours * 60 * 60 * 1000;
  db.prepare(
    'INSERT INTO invites (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), normalized, now, expiresAt);
  return { token, expiresAt };
}

export function redeemInvite(token: string): { email: string; sessionToken: string } | null {
  const now = Date.now();
  const invite = db
    .prepare('SELECT email, expires_at, redeemed_at FROM invites WHERE token_hash = ?')
    .get(hashToken(token)) as
    | { email: string; expires_at: number; redeemed_at: number | null }
    | undefined;

  if (!invite || invite.redeemed_at !== null || invite.expires_at < now) return null;
  // The allowlist can change after an invite is minted, so re-check at redemption.
  if (!isAllowed(invite.email)) return null;

  db.prepare('UPDATE invites SET redeemed_at = ? WHERE token_hash = ?').run(
    now,
    hashToken(token),
  );

  return { email: invite.email, sessionToken: createSession(invite.email) };
}

export const MIN_PASSWORD_LENGTH = 12;

const SCRYPT_KEY_LENGTH = 64;

function derive(password: string, salt: string): Buffer {
  return scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEY_LENGTH);
}

export function setPassword(email: string, password: string): void {
  const normalized = email.trim().toLowerCase();
  const salt = randomBytes(16).toString('hex');
  db.prepare(
    `INSERT INTO passwords (email, hash, salt, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, salt = excluded.salt, updated_at = excluded.updated_at`,
  ).run(normalized, derive(password, salt).toString('hex'), salt, Date.now());
}

export function hasPassword(email: string): boolean {
  return db.prepare('SELECT 1 FROM passwords WHERE email = ?').get(email.trim().toLowerCase()) !== undefined;
}

/**
 * Always does the same scrypt work, so an unknown address cannot be told apart
 * from a wrong password by how long the reply takes.
 */
export function verifyPassword(email: string, password: string): boolean {
  const normalized = email.trim().toLowerCase();
  const row = db.prepare('SELECT hash, salt FROM passwords WHERE email = ?').get(normalized) as
    | { hash: string; salt: string }
    | undefined;

  const salt = row?.salt ?? 'absent';
  const expected = Buffer.from(row?.hash ?? derive('absent', 'absent').toString('hex'), 'hex');
  const actual = derive(password, salt);

  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  return matches && row !== undefined && isAllowed(normalized);
}

export function createSession(email: string): string {
  const token = newToken();
  const now = Date.now();
  db.prepare(
    'INSERT INTO sessions (token_hash, email, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
  ).run(hashToken(token), email, now, now + config.sessionDays * 24 * 60 * 60 * 1000, now);
  return token;
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function resolveSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const now = Date.now();
  const row = db
    .prepare('SELECT email, expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token)) as { email: string; expires_at: number } | undefined;

  if (!row || row.expires_at < now) return null;
  // Revoking access is just removing the email from ALLOWED_EMAILS.
  if (!isAllowed(row.email)) return null;

  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(
    now,
    hashToken(token),
  );

  return { email: row.email, isAdmin: row.email === config.adminEmail };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
    // Signed with SESSION_SECRET, so rotating that secret signs everyone out.
    signed: true,
  });
}

export function sessionTokenFrom(req: Request): string | undefined {
  const token = req.signedCookies?.[SESSION_COOKIE];
  return typeof token === 'string' ? token : undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = resolveSession(sessionTokenFrom(req));
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}
