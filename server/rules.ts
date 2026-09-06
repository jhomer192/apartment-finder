import { z } from 'zod';
import { db } from './db.js';
import type { ScoredListing } from './scoring.js';

/**
 * Standing filters for the whole group: places nobody will live in, and
 * ceilings nobody will go over. They are shared rather than per person because
 * everyone is renting the same apartment, and they apply to browsing, Claude
 * and alerts alike so a ruled-out neighborhood cannot reappear through a
 * different door.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS house_rules (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    rules      TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

export const houseRulesSchema = z.object({
  excludedNeighborhoods: z.array(z.string().max(60)).max(40).default([]),
  /** 0 means the group set no ceiling of that kind. */
  maxRent: z.number().int().min(0).max(100_000).default(0),
  maxRentPerBedroom: z.number().int().min(0).max(100_000).default(0),
  minBedrooms: z.number().int().min(0).max(8).default(0),
  maxScamScore: z.number().int().min(0).max(100).default(100),
});

export type HouseRules = z.infer<typeof houseRulesSchema>;

export const NO_RULES: HouseRules = houseRulesSchema.parse({});

export interface StoredRules {
  rules: HouseRules;
  updatedBy: string | null;
  updatedAt: number | null;
}

export function getHouseRules(): StoredRules {
  const row = db.prepare('SELECT rules, updated_by, updated_at FROM house_rules WHERE id = 1').get() as
    | { rules: string; updated_by: string; updated_at: number }
    | undefined;
  if (!row) return { rules: NO_RULES, updatedBy: null, updatedAt: null };

  // A rule written by an older version must not lock everyone out of the app.
  const parsed = houseRulesSchema.safeParse(JSON.parse(row.rules) as unknown);
  return {
    rules: parsed.success ? parsed.data : NO_RULES,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export function setHouseRules(rules: HouseRules, email: string, now = Date.now()): StoredRules {
  db.prepare(
    `INSERT INTO house_rules (id, rules, updated_by, updated_at) VALUES (1, @rules, @email, @now)
     ON CONFLICT(id) DO UPDATE SET rules = @rules, updated_by = @email, updated_at = @now`,
  ).run({ rules: JSON.stringify(rules), email, now });

  return { rules, updatedBy: email, updatedAt: now };
}

/** Studios house someone, so they count as one share of the rent. */
function shares(listing: ScoredListing): number {
  return Math.max(listing.bedrooms ?? 1, 1);
}

export function allowedByRules(listing: ScoredListing, rules: HouseRules): boolean {
  const excluded = rules.excludedNeighborhoods.map((hood) => hood.toLowerCase());
  if (excluded.includes(listing.neighborhood.toLowerCase())) return false;
  if (rules.maxRent > 0 && listing.price > rules.maxRent) return false;
  if (rules.maxRentPerBedroom > 0 && listing.price / shares(listing) > rules.maxRentPerBedroom) {
    return false;
  }
  if ((listing.bedrooms ?? 0) < rules.minBedrooms) return false;
  if (listing.scam.score > rules.maxScamScore) return false;
  return true;
}

/** One line per rule, for the Claude prompt and the plan summary in the UI. */
export function describeRules(rules: HouseRules): string[] {
  const lines: string[] = [];
  if (rules.excludedNeighborhoods.length > 0) {
    lines.push(`never ${rules.excludedNeighborhoods.join(', ')}`);
  }
  if (rules.maxRent > 0) lines.push(`rent at most $${rules.maxRent.toLocaleString()}`);
  if (rules.maxRentPerBedroom > 0) {
    lines.push(`at most $${rules.maxRentPerBedroom.toLocaleString()} per bedroom`);
  }
  if (rules.minBedrooms > 0) lines.push(`at least ${rules.minBedrooms} bedrooms`);
  if (rules.maxScamScore < 100) lines.push(`scam risk at most ${rules.maxScamScore}/100`);
  return lines;
}
