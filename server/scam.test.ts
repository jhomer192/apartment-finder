import { describe, expect, it } from 'vitest';
import { crossListingSignals, mergeAssessments, scoreHeuristics } from './scam.js';
import type { RawListing } from './sources/types.js';

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    sourceId: 'test',
    sourceName: 'Test',
    externalId: 'abc',
    title: '2 Bedroom in the Mission',
    description: 'A'.repeat(400),
    price: 4200,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 900,
    address: '123 Valencia St',
    city: 'San Francisco',
    lat: 37.76,
    lng: -122.42,
    url: 'https://example.com/abc',
    imageUrl: null,
    imageUrls: [],
    photoCount: 12,
    postedAt: Date.now(),
    contactEmail: null,
    contactPhone: null,
    detail: 'full',
    ...overrides,
  };
}

describe('scoreHeuristics', () => {
  it('clears an ordinary market-rate listing', () => {
    const result = scoreHeuristics(listing());
    expect(result.score).toBe(0);
    expect(result.band).toBe('low');
    expect(result.reasons).toEqual([]);
  });

  it('flags payment methods that cannot be reversed', () => {
    const result = scoreHeuristics(
      listing({ description: `Send the deposit by wire transfer or Zelle. ${'A'.repeat(400)}` }),
    );
    expect(result.reasons).toContain('Asks for wire transfer or money-order payment');
    expect(result.reasons).toContain('Wants payment via an irreversible method');
    expect(result.band).not.toBe('low');
  });

  it('flags an absent owner who wants money before a viewing', () => {
    const result = scoreHeuristics(
      listing({
        description:
          'I am currently out of the country on missionary work, so the keys will be mailed ' +
          `to you once the deposit is received before you view the unit. ${'A'.repeat(300)}`,
      }),
    );
    expect(result.band).toBe('high');
    expect(result.reasons).toContain('Owner claims to be out of the country');
    expect(result.reasons).toContain('Offers to mail the keys instead of meeting');
  });

  it('scales with how far below market the rent is', () => {
    const halfPrice = scoreHeuristics(listing({ price: 2300 })).score;
    const tenthPrice = scoreHeuristics(listing({ price: 900 })).score;
    expect(halfPrice).toBeGreaterThan(0);
    expect(tenthPrice).toBeGreaterThan(halfPrice);
  });

  it('penalises listings with nothing to verify', () => {
    const result = scoreHeuristics(
      listing({ photoCount: 0, address: '', description: 'Nice place, call me.' }),
    );
    expect(result.reasons).toEqual([
      'No photos on the listing',
      'No street address given',
      'Unusually short description',
    ]);
  });

  it('reports the checks a clean listing passed', () => {
    const result = scoreHeuristics(listing());
    expect(result.checks).toEqual([
      'Rent is in line with the SF median for this size',
      '12 photos published',
      'Full street address published',
    ]);
  });

  it('flags an address that cannot be pinned to a building', () => {
    const result = scoreHeuristics(listing({ address: 'Mission District' }));
    expect(result.reasons).toContain('Address has no street number, so the unit cannot be verified');
  });

  it('flags a listing that publishes barely any photos', () => {
    expect(scoreHeuristics(listing({ photoCount: 1 })).reasons).toContain('Only 1 photo');
    expect(scoreHeuristics(listing({ photoCount: 2 })).reasons).toContain('Only 2 photos');
  });

  it('does not read a summary source\'s missing fields as concealment', () => {
    const withheld = { photoCount: 0, address: '', description: '' };
    expect(scoreHeuristics(listing({ ...withheld, detail: 'summary' })).score).toBe(0);
    expect(scoreHeuristics(listing({ ...withheld, detail: 'full' })).score).toBeGreaterThan(0);
  });

  it('never exceeds 100', () => {
    const result = scoreHeuristics(
      listing({
        price: 500,
        photoCount: 0,
        address: '',
        description:
          'URGENT act fast. I am out of the country, keys will be mailed after a wire transfer ' +
          'or Zelle deposit before you view it. No credit check. God bless. Text only.',
      }),
    );
    expect(result.score).toBe(100);
    expect(result.band).toBe('high');
  });
});

describe('crossListingSignals', () => {
  const photo = 'https://cdn.example.com/a.jpg';

  it('flags the cheap copy of an address listed elsewhere for much more', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'real', price: 4200 }),
      listing({ externalId: 'bait', price: 1800, address: '123 valencia street' }),
    ]);
    expect(signals.get('test:real')).toBeUndefined();
    expect(signals.get('test:bait')?.reasons).toEqual([
      'Same address is listed at $4,200 elsewhere but asks $1,800 here',
    ]);
  });

  it('leaves an ordinary cross-post alone', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'a', price: 4200 }),
      listing({ externalId: 'b', price: 4100 }),
    ]);
    expect(signals.size).toBe(0);
  });

  it('flags a lead photo reused at another address', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'a', imageUrl: photo }),
      listing({ externalId: 'b', imageUrl: photo, address: '900 Market St' }),
    ]);
    expect(signals.get('test:a')?.reasons).toContain(
      'Lead photo is reused on a listing at a different address',
    );
    expect(signals.get('test:b')?.score).toBe(30);
  });

  it('accepts the same photo on the same address', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'a', imageUrl: photo }),
      listing({ externalId: 'b', imageUrl: photo }),
    ]);
    expect(signals.size).toBe(0);
  });
});

describe('mergeAssessments', () => {
  it('adds batch signals to the cached verdict without losing its checks', () => {
    const base = { score: 20, band: 'low' as const, reasons: ['thin'], checks: ['photos'] };
    const merged = mergeAssessments(base, {
      score: 30,
      band: 'medium' as const,
      reasons: ['reused photo'],
      checks: [],
    });
    expect(merged).toEqual({
      score: 50,
      band: 'medium',
      reasons: ['thin', 'reused photo'],
      checks: ['photos'],
    });
  });

  it('returns the base verdict when a listing has no batch signals', () => {
    const base = { score: 0, band: 'low' as const, reasons: [], checks: [] };
    expect(mergeAssessments(base, undefined)).toBe(base);
  });
});
