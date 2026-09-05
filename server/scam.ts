import { db } from './db.js';
import { askClaude } from './claude.js';
import type { RawListing } from './sources/types.js';

export type ScamBand = 'low' | 'medium' | 'high';

export interface ScamAssessment {
  score: number;
  band: ScamBand;
  reasons: string[];
}

/**
 * Phrases that recur in rental-scam listings: the "landlord" is unreachable,
 * wants money before a viewing, or steers the conversation off-platform.
 */
const RED_FLAG_PATTERNS: Array<{ pattern: RegExp; weight: number; reason: string }> = [
  { pattern: /\bwire\s+transfer\b|\bwestern\s+union\b|\bmoneygram\b/i, weight: 30, reason: 'Asks for wire transfer or money-order payment' },
  { pattern: /\b(zelle|venmo|cash\s?app|bitcoin|crypto|gift\s?card)\b/i, weight: 25, reason: 'Wants payment via an irreversible method' },
  { pattern: /\bout\s+of\s+(the\s+)?(country|state|town)\b|\bmissionary\b|\brelocated\s+abroad\b/i, weight: 25, reason: 'Owner claims to be out of the country' },
  { pattern: /\bdeposit\b[^.]{0,60}\bbefore\b[^.]{0,40}\b(view|see|tour|visit)/i, weight: 30, reason: 'Requests a deposit before any viewing' },
  { pattern: /\bkeys?\s+(will\s+be\s+)?(mailed|shipped|sent)\b/i, weight: 30, reason: 'Offers to mail the keys instead of meeting' },
  { pattern: /\bno\s+(credit\s+check|background\s+check)\b/i, weight: 10, reason: 'No credit or background check' },
  { pattern: /\bgod\s+bless\b|\bfaithful\s+tenant\b/i, weight: 10, reason: 'Emotional or religious appeal common in scam posts' },
  { pattern: /\b(urgent|asap|act\s+fast|first\s+come\s+first\s+serve)\b/i, weight: 8, reason: 'High-pressure urgency language' },
  { pattern: /\bcontact\s+me\s+(at|on|via)\b[^.]{0,40}@/i, weight: 15, reason: 'Pushes contact to a personal email address' },
  { pattern: /\btext\s+only\b|\bdo\s+not\s+call\b/i, weight: 8, reason: 'Refuses phone contact' },
];

const MEDIAN_SF_RENT_BY_BEDROOM: Record<number, number> = {
  0: 2300,
  1: 3100,
  2: 4200,
  3: 5400,
  4: 6800,
};

export function listingKey(listing: RawListing): string {
  return `${listing.sourceId}:${listing.externalId}`;
}

function bandFor(score: number): ScamBand {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Deterministic signals only — cheap, offline, and applied to every listing.
 * A listing priced far below market is the single strongest scam predictor.
 */
export function scoreHeuristics(listing: RawListing): ScamAssessment {
  const reasons: string[] = [];
  let score = 0;

  const text = `${listing.title} ${listing.description}`;
  for (const { pattern, weight, reason } of RED_FLAG_PATTERNS) {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(reason);
    }
  }

  const median = MEDIAN_SF_RENT_BY_BEDROOM[listing.bedrooms ?? 1] ?? MEDIAN_SF_RENT_BY_BEDROOM[1];
  const ratio = listing.price / median;
  if (ratio < 0.4) {
    score += 35;
    reasons.push(`Rent is ${Math.round((1 - ratio) * 100)}% below the SF median for this size`);
  } else if (ratio < 0.6) {
    score += 20;
    reasons.push(`Rent is well below the SF median for this size`);
  }

  if (listing.photoCount === 0) {
    score += 12;
    reasons.push('No photos on the listing');
  }

  if (listing.description.length > 0 && listing.description.length < 120) {
    score += 8;
    reasons.push('Unusually short description');
  }

  if (!listing.address) {
    score += 10;
    reasons.push('No street address given');
  }

  const capped = Math.min(score, 100);
  return { score: capped, band: bandFor(capped), reasons };
}

interface ClaudeVerdict {
  score?: number;
  reasons?: string[];
}

/**
 * Claude only adjudicates listings the heuristics already find suspicious, so a
 * page of results costs at most a handful of calls.
 */
export async function assessWithClaude(listing: RawListing): Promise<ScamAssessment | null> {
  const prompt = [
    'You are screening a rental listing for signs of a rental scam.',
    'Respond with ONLY a JSON object: {"score": <0-100 integer>, "reasons": [<short strings>]}.',
    'A high score means likely scam. Base it on the listing text alone.',
    '',
    `Title: ${listing.title}`,
    `Price: $${listing.price}/mo`,
    `Bedrooms: ${listing.bedrooms ?? 'unknown'}`,
    `Address: ${listing.address || 'not given'}`,
    `Photos: ${listing.photoCount}`,
    `Description: ${listing.description.slice(0, 1500) || '(none)'}`,
  ].join('\n');

  const raw = await askClaude(prompt);
  if (!raw) return null;

  const json = raw.match(/\{[\s\S]*\}/);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json[0]) as ClaudeVerdict;
    if (typeof parsed.score !== 'number') return null;
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    return {
      score,
      band: bandFor(score),
      reasons: (parsed.reasons ?? []).slice(0, 5).map(String),
    };
  } catch {
    return null;
  }
}

function readCache(key: string, maxAgeMs: number): ScamAssessment | null {
  const row = db
    .prepare('SELECT score, band, reasons, assessed_at FROM scam_assessments WHERE listing_key = ?')
    .get(key) as { score: number; band: ScamBand; reasons: string; assessed_at: number } | undefined;

  if (!row || Date.now() - row.assessed_at > maxAgeMs) return null;
  return { score: row.score, band: row.band, reasons: JSON.parse(row.reasons) as string[] };
}

function writeCache(key: string, assessment: ScamAssessment): void {
  db.prepare(
    `INSERT INTO scam_assessments (listing_key, score, band, reasons, assessed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(listing_key) DO UPDATE SET
       score = excluded.score, band = excluded.band,
       reasons = excluded.reasons, assessed_at = excluded.assessed_at`,
  ).run(key, assessment.score, assessment.band, JSON.stringify(assessment.reasons), Date.now());
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLAUDE_REVIEW_THRESHOLD = 25;

export async function assessListing(listing: RawListing): Promise<ScamAssessment> {
  const key = listingKey(listing);
  const cached = readCache(key, CACHE_TTL_MS);
  if (cached) return cached;

  const heuristic = scoreHeuristics(listing);

  let assessment = heuristic;
  if (heuristic.score >= CLAUDE_REVIEW_THRESHOLD) {
    const verdict = await assessWithClaude(listing).catch(() => null);
    if (verdict) {
      // Keep the more cautious of the two, and merge the explanations.
      const score = Math.max(heuristic.score, verdict.score);
      assessment = {
        score,
        band: bandFor(score),
        reasons: [...new Set([...heuristic.reasons, ...verdict.reasons])],
      };
    }
  }

  writeCache(key, assessment);
  return assessment;
}
