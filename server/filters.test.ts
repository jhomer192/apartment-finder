import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db.js';
import { deleteFilter, filterSchema, listFilters, saveFilter } from './filters.js';

function check(overrides: Record<string, unknown> = {}) {
  return filterSchema.parse({ name: 'Three bedrooms', minRent: 3000, maxRent: 7000, minBedrooms: 3, ...overrides });
}

beforeEach(() => {
  db.prepare('DELETE FROM saved_filters').run();
});

describe('saved searches', () => {
  it('keeps every part of the search, not just the rent', () => {
    saveFilter(check({ neighborhoods: ['Mission'], sort: 'ppbed', dedupe: false, maxBathrooms: 2 }), 'jack@example.com');

    expect(listFilters()).toEqual([
      expect.objectContaining({
        name: 'Three bedrooms',
        minRent: 3000,
        maxRent: 7000,
        minBedrooms: 3,
        maxBathrooms: 2,
        dedupe: false,
        neighborhoods: ['Mission'],
        sort: 'ppbed',
        createdBy: 'jack@example.com',
      }),
    ]);
  });

  it('overwrites a search saved again under the same name', () => {
    const first = saveFilter(check(), 'jack@example.com');
    const second = saveFilter(check({ maxRent: 5000 }), 'garrett@example.com');

    expect(second.id).toBe(first.id);
    expect(listFilters()).toHaveLength(1);
    expect(listFilters()[0].maxRent).toBe(5000);
  });

  it('treats a name as taken whatever the capitalisation', () => {
    saveFilter(check({ name: 'Three bedrooms' }), 'jack@example.com');
    saveFilter(check({ name: 'THREE BEDROOMS' }), 'jack@example.com');

    expect(listFilters()).toHaveLength(1);
  });

  it('deletes by id and reports an unknown id', () => {
    const saved = saveFilter(check(), 'jack@example.com');

    expect(deleteFilter(saved.id)).toBe(true);
    expect(deleteFilter(saved.id)).toBe(false);
    expect(listFilters()).toEqual([]);
  });

  it('rejects a nameless search and an unknown sort', () => {
    expect(filterSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(filterSchema.safeParse({ name: 'ok', sort: 'rm -rf' }).success).toBe(false);
  });

  it('skips a stored search an older version wrote badly rather than hiding the rest', () => {
    saveFilter(check(), 'jack@example.com');
    db.prepare('INSERT INTO saved_filters (name, filter, created_by, created_at) VALUES (?, ?, ?, ?)').run(
      'From the future',
      JSON.stringify({ sort: 'vibes' }),
      'jack@example.com',
      Date.now(),
    );

    expect(listFilters().map((filter) => filter.name)).toEqual(['Three bedrooms']);
  });
});
