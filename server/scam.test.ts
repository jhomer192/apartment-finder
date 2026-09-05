import { describe, expect, it } from 'vitest';
import { scoreHeuristics } from './scam.js';
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
    photoCount: 12,
    postedAt: Date.now(),
    contactEmail: null,
    contactPhone: null,
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
      'Unusually short description',
      'No street address given',
    ]);
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
