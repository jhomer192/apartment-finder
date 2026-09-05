import { describe, expect, it } from 'vitest';
import type { TourDay } from '../api/types';
import { toEpoch, worthReordering } from './tours';

function day(overrides: Partial<TourDay> = {}): TourDay {
  return {
    date: '2026-03-14',
    tours: ['a', 'b', 'c'].map((key, index) => ({
      id: index,
      listingKey: key,
      startsAt: 0,
      minutes: 30,
      note: '',
      createdBy: 'jack@example.com',
      listing: { key } as TourDay['tours'][number]['listing'],
      travelKm: null,
      travelMinutes: null,
      warning: null,
    })),
    suggestedOrder: ['b', 'a', 'c'],
    bookedKm: 12,
    suggestedKm: 7,
    routeUrl: null,
    ...overrides,
  };
}

describe('toEpoch', () => {
  it('reads the date and time inputs as a single moment', () => {
    expect(toEpoch('2026-03-14', '10:30')).toBe(new Date('2026-03-14T10:30').getTime());
  });

  it('is null until both are filled in', () => {
    expect(toEpoch('', '10:30')).toBeNull();
    expect(toEpoch('2026-03-14', '')).toBeNull();
  });
});

describe('worthReordering', () => {
  it('suggests a reorder that saves real distance', () => {
    expect(worthReordering(day())).toBe(true);
  });

  it('stays quiet when the booked order is already the short one', () => {
    expect(worthReordering(day({ suggestedOrder: ['a', 'b', 'c'], suggestedKm: 12 }))).toBe(false);
  });

  it('stays quiet over a rounding-error saving', () => {
    expect(worthReordering(day({ suggestedKm: 11.8 }))).toBe(false);
  });

  it('stays quiet with fewer than three stops', () => {
    const two = day();
    expect(worthReordering({ ...two, tours: two.tours.slice(0, 2) })).toBe(false);
  });
});
