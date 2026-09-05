import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  getPrefs,
  matches,
  recordSeen,
  runSweep,
  setPrefs,
  type AlertPrefs,
} from './alerts.js';
import { db } from './db.js';
import { storeListings } from './inventory.js';
import type { ScoredListing } from './listings.js';
import { houseRulesSchema, setHouseRules } from './rules.js';

function listing(overrides: Partial<ScoredListing>): ScoredListing {
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
    sqft: 900,
    address: '1 Main St',
    city: 'San Francisco',
    neighborhood: 'Mission',
    area: null,
    lat: 37.76,
    lng: -122.42,
    url: 'https://example.com/1',
    imageUrl: null,
    imageUrls: [],
    photoCount: 3,
    postedAt: null,
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    scam: { score: 5, band: 'low', reasons: [], checks: [] },
    ...overrides,
  };
}

const prefs = (overrides: Partial<AlertPrefs> = {}): AlertPrefs => ({
  ...DEFAULT_PREFS,
  enabled: true,
  ...overrides,
});

beforeEach(() => {
  db.exec(
    'DELETE FROM alert_prefs; DELETE FROM alerts_sent; DELETE FROM listings_seen; DELETE FROM inventory; DELETE FROM house_rules;',
  );
});

describe('alert preferences', () => {
  it('gives someone who has never set them a default of alerts off', () => {
    expect(getPrefs('nobody@example.com')).toEqual(DEFAULT_PREFS);
  });

  it('keeps each roommate on their own filter', () => {
    setPrefs('a@example.com', prefs({ maxRent: 3000, neighborhoods: ['Mission'] }));
    setPrefs('b@example.com', prefs({ maxRent: 6000, viaDiscord: true }));

    expect(getPrefs('a@example.com')).toMatchObject({ maxRent: 3000, neighborhoods: ['Mission'] });
    expect(getPrefs('b@example.com')).toMatchObject({ maxRent: 6000, viaDiscord: true });
  });

  it('overwrites rather than duplicates when settings are saved again', () => {
    setPrefs('a@example.com', prefs({ maxRent: 3000 }));
    setPrefs('a@example.com', prefs({ maxRent: 4200 }));

    expect(getPrefs('a@example.com').maxRent).toBe(4200);
    expect(db.prepare('SELECT COUNT(*) AS n FROM alert_prefs').get()).toEqual({ n: 1 });
  });
});

describe('matches', () => {
  it('accepts a listing inside every bound', () => {
    expect(matches(listing({}), prefs({ maxRent: 4500, minBedrooms: 2 }))).toBe(true);
  });

  it('rejects on rent, bedrooms, scam score, and neighborhood independently', () => {
    expect(matches(listing({ price: 9000 }), prefs())).toBe(false);
    expect(matches(listing({ bedrooms: 1 }), prefs({ minBedrooms: 2 }))).toBe(false);
    expect(
      matches(listing({ scam: { score: 70, band: 'high', reasons: ['wire'], checks: [] } }), prefs()),
    ).toBe(false);
    expect(matches(listing({ neighborhood: 'SoMa' }), prefs({ neighborhoods: ['Mission'] }))).toBe(
      false,
    );
  });

  it('treats an empty neighborhood list as anywhere', () => {
    expect(matches(listing({ neighborhood: 'Bayview' }), prefs())).toBe(true);
  });
});

describe('runSweep', () => {
  it('never treats a listing in a ruled-out neighborhood as new', async () => {
    setHouseRules(houseRulesSchema.parse({ excludedNeighborhoods: ['Tenderloin'] }), 'jack@example.com');
    storeListings([listing({ key: 'old' })], Date.now());
    await runSweep();

    storeListings([listing({ key: 'tl', neighborhood: 'Tenderloin' })], Date.now());

    expect((await runSweep()).newListings).toBe(0);
  });
});

describe('recordSeen', () => {
  it('reports nothing the first time so switching alerts on is not a flood', () => {
    const fresh = recordSeen([listing({ key: 'a' }), listing({ key: 'b' })]);
    expect(fresh).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM listings_seen').get()).toEqual({ n: 2 });
  });

  it('reports only keys it has never seen on later sweeps', () => {
    recordSeen([listing({ key: 'a' })]);
    const fresh = recordSeen([listing({ key: 'a' }), listing({ key: 'b' })]);
    expect(fresh.map((item) => item.key)).toEqual(['b']);
  });

  it('does not report the same listing twice across sweeps', () => {
    recordSeen([listing({ key: 'a' })]);
    recordSeen([listing({ key: 'a' }), listing({ key: 'b' })]);
    expect(recordSeen([listing({ key: 'a' }), listing({ key: 'b' })])).toEqual([]);
  });
});
