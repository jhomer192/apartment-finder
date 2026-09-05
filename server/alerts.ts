import { z } from 'zod';
import { config } from './config.js';
import { db } from './db.js';
import { getListings, type ScoredListing } from './listings.js';
import { mailConfigured, sendAlertEmail } from './mailer.js';

export const alertPrefsSchema = z.object({
  enabled: z.boolean(),
  minRent: z.number().int().min(0).max(100_000),
  maxRent: z.number().int().min(1).max(100_000),
  minBedrooms: z.number().int().min(0).max(8),
  neighborhoods: z.array(z.string().max(60)).max(30),
  maxScamScore: z.number().int().min(0).max(100),
  viaEmail: z.boolean(),
  viaDiscord: z.boolean(),
});

export type AlertPrefs = z.infer<typeof alertPrefsSchema>;

export const DEFAULT_PREFS: AlertPrefs = {
  enabled: false,
  minRent: 0,
  maxRent: 8000,
  minBedrooms: 0,
  neighborhoods: [],
  maxScamScore: 25,
  viaEmail: true,
  viaDiscord: false,
};

interface PrefsRow {
  email: string;
  enabled: number;
  min_rent: number;
  max_rent: number;
  min_bedrooms: number;
  neighborhoods: string;
  max_scam_score: number;
  via_email: number;
  via_discord: number;
}

function hydrate(row: PrefsRow): AlertPrefs {
  const neighborhoods = z
    .array(z.string())
    .catch([])
    .parse(JSON.parse(row.neighborhoods) as unknown);

  return {
    enabled: row.enabled === 1,
    minRent: row.min_rent,
    maxRent: row.max_rent,
    minBedrooms: row.min_bedrooms,
    neighborhoods,
    maxScamScore: row.max_scam_score,
    viaEmail: row.via_email === 1,
    viaDiscord: row.via_discord === 1,
  };
}

export function getPrefs(email: string): AlertPrefs {
  const row = db.prepare('SELECT * FROM alert_prefs WHERE email = ?').get(email) as
    | PrefsRow
    | undefined;
  return row ? hydrate(row) : DEFAULT_PREFS;
}

export function setPrefs(email: string, prefs: AlertPrefs): AlertPrefs {
  db.prepare(
    `INSERT INTO alert_prefs
       (email, enabled, min_rent, max_rent, min_bedrooms, neighborhoods, max_scam_score,
        via_email, via_discord, updated_at)
     VALUES (@email, @enabled, @minRent, @maxRent, @minBedrooms, @neighborhoods, @maxScamScore,
             @viaEmail, @viaDiscord, @now)
     ON CONFLICT(email) DO UPDATE SET
       enabled = @enabled, min_rent = @minRent, max_rent = @maxRent,
       min_bedrooms = @minBedrooms, neighborhoods = @neighborhoods,
       max_scam_score = @maxScamScore, via_email = @viaEmail, via_discord = @viaDiscord,
       updated_at = @now`,
  ).run({
    email,
    enabled: prefs.enabled ? 1 : 0,
    minRent: prefs.minRent,
    maxRent: prefs.maxRent,
    minBedrooms: prefs.minBedrooms,
    neighborhoods: JSON.stringify(prefs.neighborhoods),
    maxScamScore: prefs.maxScamScore,
    viaEmail: prefs.viaEmail ? 1 : 0,
    viaDiscord: prefs.viaDiscord ? 1 : 0,
    now: Date.now(),
  });

  return prefs;
}

export function matches(listing: ScoredListing, prefs: AlertPrefs): boolean {
  if (listing.price < prefs.minRent || listing.price > prefs.maxRent) return false;
  if ((listing.bedrooms ?? 0) < prefs.minBedrooms) return false;
  if (listing.scam.score > prefs.maxScamScore) return false;
  if (prefs.neighborhoods.length > 0) {
    const wanted = prefs.neighborhoods.map((hood) => hood.toLowerCase());
    if (!wanted.includes(listing.neighborhood.toLowerCase())) return false;
  }
  return true;
}

/**
 * Records every key we can see and returns the ones that are new. The first
 * call on an empty table returns nothing: everything already listed is old news.
 */
export function recordSeen(listings: ScoredListing[], now = Date.now()): ScoredListing[] {
  const seeded = (db.prepare('SELECT COUNT(*) AS n FROM listings_seen').get() as { n: number }).n > 0;
  const insert = db.prepare(
    'INSERT INTO listings_seen (listing_key, first_seen_at) VALUES (?, ?) ON CONFLICT DO NOTHING',
  );

  const fresh: ScoredListing[] = [];
  db.transaction(() => {
    for (const listing of listings) {
      if (insert.run(listing.key, now).changes === 1 && seeded) fresh.push(listing);
    }
  })();

  return fresh;
}

function unsent(email: string, listings: ScoredListing[]): ScoredListing[] {
  const seen = db.prepare('SELECT 1 FROM alerts_sent WHERE email = ? AND listing_key = ?');
  return listings.filter((listing) => !seen.get(email, listing.key));
}

function markSent(email: string, listings: ScoredListing[], now = Date.now()): void {
  const insert = db.prepare(
    'INSERT INTO alerts_sent (email, listing_key, sent_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
  );
  db.transaction(() => {
    for (const listing of listings) insert.run(email, listing.key, now);
  })();
}

function line(listing: ScoredListing): string {
  return (
    `$${listing.price.toLocaleString()}/mo · ${listing.bedrooms ?? '?'}bd · ${listing.neighborhood}` +
    ` · scam risk ${listing.scam.score}/100\n${listing.title.replace(/\s+/g, ' ')}\n${listing.url}`
  );
}

export function discordConfigured(): boolean {
  return config.discordWebhookUrl.length > 0;
}

async function sendDiscord(email: string, listings: ScoredListing[]): Promise<void> {
  const response = await fetch(config.discordWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      // The mention is the address, not a ping: the webhook posts to one channel
      // and the group needs to know whose filter matched.
      content: [`**New SF listings for ${email}**`, ...listings.map(line)].join('\n\n').slice(0, 1900),
    }),
  });
  if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
}

export interface SweepResult {
  newListings: number;
  delivered: { email: string; count: number; channels: string[] }[];
}

/** One pass: look for listings we have never seen, then tell whoever asked. */
export async function runSweep(): Promise<SweepResult> {
  const { listings } = await getListings({
    minRent: 0,
    maxRent: 100_000,
    minBedrooms: null,
    maxBedrooms: null,
    limit: 5000,
    // A unit posted to four sites is one new apartment, not four emails.
    dedupe: true,
  });
  const fresh = recordSeen(listings);
  const result: SweepResult = { newListings: fresh.length, delivered: [] };
  if (fresh.length === 0) return result;

  const rows = db.prepare('SELECT * FROM alert_prefs WHERE enabled = 1').all() as PrefsRow[];
  for (const row of rows) {
    const prefs = hydrate(row);
    // Someone taken off the allowlist keeps their row but stops being mailed.
    if (!config.allowedEmails.includes(row.email)) continue;

    const hits = unsent(row.email, fresh.filter((listing) => matches(listing, prefs))).slice(
      0,
      config.alertsPerRun,
    );
    if (hits.length === 0) continue;

    const channels: string[] = [];
    if (prefs.viaEmail && mailConfigured()) {
      try {
        await sendAlertEmail(row.email, hits.map(line));
        channels.push('email');
      } catch (error) {
        console.error('alert email failed:', error instanceof Error ? error.message : error);
      }
    }
    if (prefs.viaDiscord && discordConfigured()) {
      try {
        await sendDiscord(row.email, hits);
        channels.push('discord');
      } catch (error) {
        console.error('alert discord failed:', error instanceof Error ? error.message : error);
      }
    }

    // Only a delivered listing counts as sent, so a failed channel retries next sweep.
    if (channels.length === 0) continue;
    markSent(row.email, hits);
    result.delivered.push({ email: row.email, count: hits.length, channels });
  }

  return result;
}

export function startAlertLoop(): void {
  const everyMs = Math.max(5, config.alertIntervalMinutes) * 60 * 1000;
  const tick = () => {
    runSweep().catch((error) => {
      console.error('alert sweep failed:', error instanceof Error ? error.message : error);
    });
  };
  // Seeds listings_seen shortly after boot so the first real sweep has a baseline.
  setTimeout(tick, 30_000).unref();
  setInterval(tick, everyMs).unref();
}
