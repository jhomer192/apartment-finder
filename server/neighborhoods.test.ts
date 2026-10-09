import { describe, expect, it } from 'vitest';
import { getMetroById } from '../src/data/metros.js';
import { sfNeighborhoodAt } from './neighborhoods.js';
import { nearestNeighborhood } from './scoring.js';

describe('sfNeighborhoodAt', () => {
  it('names the neighborhood a point falls inside', () => {
    expect(sfNeighborhoodAt(37.7847, -122.4141)).toBe('Tenderloin');
    expect(sfNeighborhoodAt(37.7717, -122.3936)).toBe('Mission Bay');
    expect(sfNeighborhoodAt(37.7300, -122.388)).toBe('Bayview Hunters Point');
    expect(sfNeighborhoodAt(37.7400, -122.415)).toBe('Bernal Heights');
  });

  it('keeps the names renters already saved', () => {
    expect(sfNeighborhoodAt(37.7599, -122.4148)).toBe('Mission District');
    expect(sfNeighborhoodAt(37.7785, -122.395)).toBe('SOMA');
  });

  it('splits Dogpatch out of Potrero Hill at I-280', () => {
    expect(sfNeighborhoodAt(37.758, -122.3878)).toBe('Dogpatch');
    expect(sfNeighborhoodAt(37.7605, -122.4018)).toBe('Potrero Hill');
  });

  it('returns null outside the city', () => {
    expect(sfNeighborhoodAt(37.6879, -122.4702)).toBeNull(); // Daly City
    expect(sfNeighborhoodAt(37.8044, -122.2712)).toBeNull(); // Oakland
  });

  it('only produces names the planner and filters know about', () => {
    const known = new Set(getMetroById('bay-area')?.neighborhoods.map((hood) => hood.name));
    for (let lat = 37.70; lat <= 37.83; lat += 0.0025) {
      for (let lng = -122.52; lng <= -122.35; lng += 0.0025) {
        const name = sfNeighborhoodAt(lat, lng);
        if (name) expect(known).toContain(name);
      }
    }
  });
});

describe('nearestNeighborhood', () => {
  it('falls back to the nearest named place outside San Francisco', () => {
    expect(nearestNeighborhood(37.8446, -122.2516)).toBe('Rockridge');
    expect(nearestNeighborhood(null, null)).toBe('Unknown');
  });
});
