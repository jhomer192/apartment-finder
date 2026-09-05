import { randomBytes } from 'node:crypto';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function parseAllowlist(raw: string): string[] {
  const emails = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    throw new Error('ALLOWED_EMAILS must contain at least one email address.');
  }
  return emails;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * In production every secret must be supplied explicitly: a generated fallback
 * would silently invalidate every session on restart.
 */
function sessionSecret(): string {
  if (isProduction) return required('SESSION_SECRET');
  return process.env.SESSION_SECRET ?? randomBytes(32).toString('hex');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 8787),
  sessionSecret: sessionSecret(),
  databasePath: process.env.DATABASE_PATH ?? 'data/apartment-finder.db',
  allowedEmails: parseAllowlist(process.env.ALLOWED_EMAILS ?? ''),
  adminEmail: (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  inviteHours: Number(process.env.INVITE_TTL_HOURS ?? 72),
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  claudeModel: process.env.CLAUDE_MODEL ?? 'sonnet',
  claudeTimeoutMs: Number(process.env.CLAUDE_TIMEOUT_MS ?? 120_000),
  /**
   * Craigslist blocks datacenter IP ranges, so the adapter stays off unless the
   * host it runs on can actually reach them.
   */
  enableCraigslist: process.env.ENABLE_CRAIGSLIST === 'true',
  listingCacheMinutes: Number(process.env.LISTING_CACHE_MINUTES ?? 30),
};

export type Config = typeof config;
