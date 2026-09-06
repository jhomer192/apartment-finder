import { describe, expect, it } from 'vitest';
import { bathroomsInRange, pricePerBedroom } from './rooms';
import { DEFAULT_SEARCH } from '../data/search';
import type { Listing, SearchParams } from '../types';

function listing(price: number, bedrooms: number): Listing {
  return { price, bedrooms } as Listing;
}

function params(overrides: Partial<SearchParams> = {}): SearchParams {
  return { ...DEFAULT_SEARCH, ...overrides };
}

describe('bathroomsInRange', () => {
  it('keeps everything, unknown counts included, when no bound is set', () => {
    expect(bathroomsInRange(1, params())).toBe(true);
    expect(bathroomsInRange(null, params())).toBe(true);
  });

  it('applies both ends of the range', () => {
    const threeToFive = params({ minBathrooms: 3, maxBathrooms: 5 });
    expect(bathroomsInRange(2, threeToFive)).toBe(false);
    expect(bathroomsInRange(3, threeToFive)).toBe(true);
    expect(bathroomsInRange(5, threeToFive)).toBe(true);
    expect(bathroomsInRange(6, threeToFive)).toBe(false);
  });

  it('drops listings whose bath count nobody published once a bound is set', () => {
    expect(bathroomsInRange(null, params({ minBathrooms: 2 }))).toBe(false);
    expect(bathroomsInRange(null, params({ maxBathrooms: 2 }))).toBe(false);
  });
});

describe('pricePerBedroom', () => {
  it('splits rent across the bedrooms', () => {
    expect(pricePerBedroom(listing(6000, 4))).toBe(1500);
    expect(pricePerBedroom(listing(3000, 1))).toBe(3000);
  });

  it('charges a studio its whole rent instead of dividing by zero', () => {
    expect(pricePerBedroom(listing(2400, 0))).toBe(2400);
  });
});
