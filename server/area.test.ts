import { describe, expect, it } from 'vitest';
import { countWithin, indexCells, railKind } from './area.js';

const CIVIC_CENTER = { lat: 37.7793, lng: -122.4193 };

/** Roughly `metres` north of a point, for building fixtures at a known distance. */
function north(lat: number, metres: number): number {
  return lat + metres / 111_320;
}

describe('countWithin', () => {
  it('adds up cells inside the radius and ignores the rest', () => {
    const index = indexCells([
      { lat: CIVIC_CENTER.lat, lng: CIVIC_CENTER.lng, count: 4 },
      { lat: north(CIVIC_CENTER.lat, 300), lng: CIVIC_CENTER.lng, count: 3 },
      { lat: north(CIVIC_CENTER.lat, 800), lng: CIVIC_CENTER.lng, count: 100 },
    ]);

    expect(countWithin(index, CIVIC_CENTER.lat, CIVIC_CENTER.lng, 500)).toBe(7);
  });

  it('finds cells that fall in a neighbouring bucket', () => {
    // 37.7749 buckets to 37.77 while a point 300m north buckets to 37.78.
    const index = indexCells([{ lat: 37.7749, lng: -122.4194, count: 5 }]);

    expect(countWithin(index, north(37.7749, 300), -122.4194, 500)).toBe(5);
  });

  it('reports zero where the city recorded nothing nearby', () => {
    const index = indexCells([{ lat: 37.7749, lng: -122.4194, count: 5 }]);

    expect(countWithin(index, 37.81, -122.47, 500)).toBe(0);
  });
});

describe('railKind', () => {
  it('labels stops by their operator', () => {
    expect(railKind({ operator: 'San Francisco Bay Area Rapid Transit District' })).toBe('BART');
    expect(railKind({ operator: 'San Francisco Municipal Railway', railway: 'station' })).toBe(
      'Muni Metro',
    );
    expect(railKind({ operator: 'San Francisco Municipal Railway', railway: 'tram_stop' })).toBe(
      'Muni rail',
    );
    expect(railKind({ operator: 'Peninsula Corridor Joint Powers Board' })).toBe('Caltrain');
  });

  it('drops stops from operators we cannot name', () => {
    expect(railKind({ operator: 'Some Heritage Railway' })).toBeNull();
    expect(railKind({})).toBeNull();
  });
});
