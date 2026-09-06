import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import {
  allowedByRules,
  describeRules,
  getHouseRules,
  houseRulesSchema,
  NO_RULES,
  setHouseRules,
} from './rules.js';
import type { ScoredListing } from './scoring.js';

function listing(overrides: Partial<ScoredListing> = {}): ScoredListing {
  return {
    sourceId: 'redfin',
    sourceName: 'Redfin',
    externalId: '1',
    key: 'redfin:1',
    title: 'Apartment',
    description: 'A place to live',
    price: 4000,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 800,
    address: '123 Valencia St',
    city: 'San Francisco',
    lat: null,
    lng: null,
    url: 'https://example.com/1',
    imageUrl: null,
    imageUrls: [],
    photoCount: 0,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    neighborhood: 'Mission District',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    area: null,
    ...overrides,
  } as ScoredListing;
}

describe('house rules', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM house_rules').run();
  });

  it('defaults to filtering nothing', () => {
    expect(getHouseRules().rules).toEqual(NO_RULES);
    expect(allowedByRules(listing({ price: 99_000, scam: { score: 100, band: 'high', reasons: [], checks: [] } }), NO_RULES)).toBe(true);
  });

  it('round-trips saved rules with who set them', () => {
    const rules = houseRulesSchema.parse({ excludedNeighborhoods: ['Tenderloin'] });
    setHouseRules(rules, 'jack@example.com', 1_000);

    const stored = getHouseRules();
    expect(stored.rules.excludedNeighborhoods).toEqual(['Tenderloin']);
    expect(stored.updatedBy).toBe('jack@example.com');
    expect(stored.updatedAt).toBe(1_000);
  });

  it('excludes a ruled-out neighborhood whatever its casing', () => {
    const rules = houseRulesSchema.parse({ excludedNeighborhoods: ['tenderloin', 'Glen Park'] });
    expect(allowedByRules(listing({ neighborhood: 'Tenderloin' }), rules)).toBe(false);
    expect(allowedByRules(listing({ neighborhood: 'Glen Park' }), rules)).toBe(false);
    expect(allowedByRules(listing({ neighborhood: 'Mission District' }), rules)).toBe(true);
  });

  it('treats a zero ceiling as no ceiling', () => {
    const rules = houseRulesSchema.parse({ maxRent: 0, maxRentPerBedroom: 0 });
    expect(allowedByRules(listing({ price: 12_000 }), rules)).toBe(true);
  });

  it('splits a per-bedroom ceiling across the bedrooms, studios counting as one', () => {
    const rules = houseRulesSchema.parse({ maxRentPerBedroom: 2500 });
    expect(allowedByRules(listing({ price: 4800, bedrooms: 2 }), rules)).toBe(true);
    expect(allowedByRules(listing({ price: 5200, bedrooms: 2 }), rules)).toBe(false);
    expect(allowedByRules(listing({ price: 2600, bedrooms: 0 }), rules)).toBe(false);
  });

  it('applies bedroom and scam floors', () => {
    const rules = houseRulesSchema.parse({ minBedrooms: 3, maxScamScore: 30 });
    expect(allowedByRules(listing({ bedrooms: 2 }), rules)).toBe(false);
    expect(allowedByRules(listing({ bedrooms: 3 }), rules)).toBe(true);
    expect(
      allowedByRules(listing({ bedrooms: 3, scam: { score: 40, band: 'medium', reasons: [], checks: [] } }), rules),
    ).toBe(false);
  });

  it('falls back to no rules when the stored row is from an incompatible version', () => {
    db.prepare(
      'INSERT INTO house_rules (id, rules, updated_by, updated_at) VALUES (1, ?, ?, ?)',
    ).run(JSON.stringify({ excludedNeighborhoods: 'Tenderloin' }), 'jack@example.com', 1);

    expect(getHouseRules().rules).toEqual(NO_RULES);
  });

  it('describes only the rules that are set', () => {
    expect(describeRules(NO_RULES)).toEqual([]);
    expect(describeRules(houseRulesSchema.parse({ excludedNeighborhoods: ['Tenderloin'], minBedrooms: 4 }))).toEqual([
      'never Tenderloin',
      'at least 4 bedrooms',
    ]);
  });
});
