import type { RailKind, SafetyGrade } from '../server/area.js';
import type { ScoredListing } from '../server/listings.js';
import type { AgentAnswer, SearchPlan } from '../server/search-agent.js';

/** Null when the answer passes; otherwise what was wrong, for the report. */
export interface Check {
  name: string;
  run: (answer: AgentAnswer) => string | null;
}

/**
 * Pick-level checks are the ones that compare across versions: an older agent
 * may have no field for "near Caltrain", but its picks are either near
 * Caltrain or not.
 */
export function everyPick(name: string, keep: (listing: ScoredListing) => boolean): Check {
  return {
    name,
    run: ({ ranked }) => {
      if (ranked.length === 0) return 'no picks';
      const failing = ranked.filter((pick) => !keep(pick.listing)).map((pick) => pick.listing.key);
      return failing.length ? `${failing.length}/${ranked.length} picks fail: ${failing.join(', ')}` : null;
    },
  };
}

export function planWhere(name: string, holds: (plan: SearchPlan) => boolean): Check {
  return { name, run: ({ plan }) => (holds(plan) ? null : `plan was ${JSON.stringify(plan)}`) };
}

export function walkTo(listing: ScoredListing, kind: RailKind | 'any'): number | null {
  if (kind === 'any') return listing.area?.transit?.walkMinutes ?? null;
  return listing.area?.rail?.[kind]?.walkMinutes ?? null;
}

export function within(listing: ScoredListing, kind: RailKind | 'any', minutes: number): boolean {
  const walk = walkTo(listing, kind);
  return walk !== null && walk <= minutes;
}

export function gradeAtLeast(listing: ScoredListing, grade: SafetyGrade): boolean {
  const actual = listing.area?.safety?.grade;
  return actual !== undefined && actual <= grade;
}

export function mentions(listing: ScoredListing, pattern: RegExp): boolean {
  return pattern.test(`${listing.title} ${listing.description}`);
}

export function perBedroom(listing: ScoredListing): number {
  return listing.price / Math.max(listing.bedrooms ?? 1, 1);
}

/** Holds for every answer to every question. */
export const UNIVERSAL: Check[] = [
  { name: 'answered', run: ({ answer }) => (answer.trim() ? null : 'empty answer') },
  { name: 'at most 6 picks', run: ({ ranked }) => (ranked.length <= 6 ? null : `${ranked.length} picks`) },
  {
    name: 'no duplicate picks',
    run: ({ ranked }) =>
      new Set(ranked.map((pick) => pick.listing.key)).size === ranked.length ? null : 'a listing was picked twice',
  },
  {
    name: 'no great deal on a likely scam',
    run: ({ ranked }) => {
      const bad = ranked.filter((pick) => pick.verdict === 'great deal' && pick.listing.scam.score >= 60);
      return bad.length ? `great deal on ${bad.map((pick) => pick.listing.key).join(', ')}` : null;
    },
  },
];

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string | null;
}

export function grade(answer: AgentAnswer | Error, checks: Check[]): CheckResult[] {
  return [...UNIVERSAL, ...checks].map((check) => {
    if (answer instanceof Error) return { name: check.name, pass: false, detail: `threw: ${answer.message}` };
    const detail = check.run(answer);
    return { name: check.name, pass: detail === null, detail };
  });
}
