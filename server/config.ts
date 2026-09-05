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

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/** Email sign-in is optional; without SMTP the CLI still mints invite links. */
function smtp(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return { host, user, pass, port: Number(process.env.SMTP_PORT ?? 587) };
}

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
  smtp: smtp(),
  mailFrom: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'apartment-finder@localhost',
  publicUrl: process.env.PUBLIC_URL ?? '',
  /** Optional: without it, Discord stays unavailable and only email alerts send. */
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? '',
  alertIntervalMinutes: Number(process.env.ALERT_INTERVAL_MINUTES ?? 60),
  /** Per sweep, per person — a source glitch should not mail out 300 listings. */
  alertsPerRun: Number(process.env.ALERTS_PER_RUN ?? 8),
};

export type Config = typeof config;
