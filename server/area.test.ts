import { describe, expect, it } from 'vitest';
import {
  countWithin,
  indexCells,
  quieterThanPercent,
  railKind,
  ratePer100k,
  safetyGrade,
} from './area.js';

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

describe('quieterThanPercent', () => {
  const city = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it('ranks a block against the rest of the city', () => {
    expect(quieterThanPercent(city, 0)).toBe(90);
    expect(quieterThanPercent(city, 5)).toBe(40);
    expect(quieterThanPercent(city, 9)).toBe(0);
  });

  it('counts ties as neither quieter nor busier', () => {
    expect(quieterThanPercent([4, 4, 4, 4], 4)).toBe(0);
    expect(quieterThanPercent([4, 4, 4, 4], 3)).toBe(100);
  });

  it('stays at zero when the city data never loaded', () => {
    expect(quieterThanPercent([], 3)).toBe(0);
  });
});

describe('ratePer100k', () => {
  it('divides reports by the people who live in the radius', () => {
    expect(ratePer100k(40, 8000)).toBe(500);
    expect(ratePer100k(0, 8000)).toBe(0);
  });

  it('does not let a dense block look worse than a sparse one for the same rate', () => {
    // Twice the reports among twice the residents is the same place to live.
    expect(ratePer100k(80, 16_000)).toBe(ratePer100k(40, 8000));
  });

  it('reports nothing where too few people live for the division to mean anything', () => {
    expect(ratePer100k(1, 30)).toBeNull();
    expect(ratePer100k(1, 199)).toBeNull();
    expect(ratePer100k(1, 200)).toBe(500);
  });
});

describe('safetyGrade', () => {
  const city = 1200;

  it('grades on the rate against the citywide rate', () => {
    expect(safetyGrade(200, city)).toBe('A');
    expect(safetyGrade(1000, city)).toBe('B');
    expect(safetyGrade(1200, city)).toBe('C');
    expect(safetyGrade(3000, city)).toBe('D');
    expect(safetyGrade(6000, city)).toBe('E');
  });

  it('does not warn about a block that matches the city average', () => {
    expect(safetyGrade(city, city)).toBe('C');
  });

  it('stays neutral when the city rate is unknown', () => {
    expect(safetyGrade(500, 0)).toBe('C');
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

  it('keeps stations that name their line only on the network tag', () => {
    expect(railKind({ network: 'Caltrain', railway: 'station', name: '22nd Street' })).toBe(
      'Caltrain',
    );
  });

  it('drops stops from operators we cannot name', () => {
    expect(railKind({ operator: 'Some Heritage Railway' })).toBeNull();
    expect(railKind({})).toBeNull();
  });
});
