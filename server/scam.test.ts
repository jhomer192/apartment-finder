import { describe, expect, it } from 'vitest';
import { crossListingSignals, mergeAssessments, scoreHeuristics } from './scam.js';
import type { RawListing } from './sources/types.js';

function listing(overrides: Partial<RawListing> = {}): RawListing {
  return {
    sourceId: 'test',
    sourceName: 'Test',
    externalId: 'abc',
    title: '2 Bedroom in the Mission',
    // Distinct per listing so batch tests exercise one signal at a time.
    description: `${'A'.repeat(400)} ref ${overrides.externalId ?? 'abc'}`,
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
      'Barely any description alongside the flags above',
    ]);
  });

  it('does not penalise a terse description on its own', () => {
    const result = scoreHeuristics(listing({ description: 'Two bed, one bath, available now.' }));
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it('measures a big house against big-house rents, not a one-bedroom', () => {
    const sixBed = listing({ bedrooms: 6, price: 9000, sqft: 3000 });
    expect(scoreHeuristics(sixBed).reasons).toEqual([]);
    expect(scoreHeuristics(listing({ bedrooms: 7, price: 9000, sqft: 3000 })).reasons).toEqual([]);
  });

  it('reports the checks a clean listing passed', () => {
    const result = scoreHeuristics(listing());
    expect(result.checks).toEqual([
      'Rent is in line with the SF median for this size',
      '12 photos published',
      'Full street address published',
      'Map pin lands in San Francisco',
    ]);
  });

  it('flags payment channels a renter cannot claw back', () => {
    const result = scoreHeuristics(
      listing({ description: `Cash only, bring a money order to hold the unit. ${'A'.repeat(400)}` }),
    );
    expect(result.reasons).toContain('Insists on cash, money order or certified funds');
    expect(result.reasons).toContain('Wants money up front to "hold" the unit');
  });

  it('flags a listing that skips the paperwork', () => {
    const result = scoreHeuristics(
      listing({ description: `No lease required, move in today. ${'A'.repeat(400)}` }),
    );
    expect(result.reasons).toContain('Says no lease or application is needed');
  });

  it('flags a rent per square foot that cannot be real', () => {
    const result = scoreHeuristics(listing({ price: 700, sqft: 900 }));
    expect(result.reasons).toContain('Asks $0.78 per sqft, far under anything real in SF');
  });

  it('flags a pin that is not in San Francisco', () => {
    const result = scoreHeuristics(listing({ lat: 34.05, lng: -118.24 }));
    expect(result.reasons).toContain('Map pin falls outside San Francisco');
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

  it('flags an identical description posted under another address', () => {
    const copy = 'Bright top-floor unit with a remodeled kitchen and in-unit laundry. '.repeat(4);
    const signals = crossListingSignals([
      listing({ externalId: 'a', description: copy }),
      listing({ externalId: 'b', description: copy, address: '900 Market St' }),
    ]);
    expect(signals.get('test:a')?.reasons).toContain(
      'Word-for-word the same description as a listing at another address',
    );
  });

  it('flags one contact posting several different addresses', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'a', contactPhone: '(415) 555-0101' }),
      listing({ externalId: 'b', contactPhone: '415-555-0101', address: '900 Market St' }),
      listing({ externalId: 'c', contactPhone: '4155550101', address: '55 Page St' }),
    ]);
    expect(signals.get('test:c')?.reasons).toContain(
      'Same contact (4155550101) is posting 3 different addresses',
    );
  });

  it('leaves a manager with two listings on one contact alone', () => {
    const signals = crossListingSignals([
      listing({ externalId: 'a', contactPhone: '4155550101' }),
      listing({ externalId: 'b', contactPhone: '4155550101', address: '900 Market St' }),
    ]);
    expect(signals.size).toBe(0);
  });

  it('flags a listing at half what the rest of the batch asks', () => {
    const batch = Array.from({ length: 9 }, (_, i) => listing({ externalId: `m${i}`, price: 4200 }));
    const signals = crossListingSignals([
      ...batch,
      listing({ externalId: 'cheap', price: 1500, address: '900 Market St' }),
    ]);
    expect(signals.get('test:cheap')?.reasons).toContain(
      'Half the going rate: other 2-bed listings in this search ask around $4,200',
    );
    expect(signals.get('test:m0')).toBeUndefined();
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
