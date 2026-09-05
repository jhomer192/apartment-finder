import { describe, expect, it } from 'vitest';
import { bathroomsInRange } from './rooms';
import { DEFAULT_SEARCH } from '../data/search';
import type { SearchParams } from '../types';

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
