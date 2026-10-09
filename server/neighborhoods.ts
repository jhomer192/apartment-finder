import { readFileSync } from 'node:fs';

/**
 * San Francisco's 41 Analysis Neighborhoods (DataSF j2bu-swwd), simplified to
 * about 4m. Snapping to the nearest of a handful of centroids filed Bayview
 * under Dogpatch and Bernal under the Mission; a boundary answers which
 * neighborhood a point is actually in.
 */
interface Area {
  name: string;
  /** [lng, lat] rings, outer first then holes, per polygon. */
  polygons: [number, number][][][];
}

/** Names the app already used, and that renters have saved in rules and alerts. */
const RENAMES: Record<string, string> = {
  Mission: 'Mission District',
  'South of Market': 'SOMA',
  Marina: 'Marina District',
  'Castro/Upper Market': 'Castro',
  'Haight Ashbury': 'Haight-Ashbury',
  'Financial District/South Beach': 'Financial District',
};

/**
 * Dogpatch has no polygon of its own; the city folds it into Potrero Hill. It
 * is the flat strip east of I-280 below Mariposa, which is how renters use it.
 */
const DOGPATCH_WEST_LNG = -122.3935;
const DOGPATCH_NORTH_LAT = 37.7640;

const AREAS = (
  JSON.parse(readFileSync(new URL('./data/sf-neighborhoods.json', import.meta.url), 'utf8')) as Area[]
).map((area) => {
  const points = area.polygons.flatMap((polygon) => polygon[0]);
  return {
    name: RENAMES[area.name] ?? area.name,
    polygons: area.polygons,
    minLng: Math.min(...points.map(([lng]) => lng)),
    maxLng: Math.max(...points.map(([lng]) => lng)),
    minLat: Math.min(...points.map(([, lat]) => lat)),
    maxLat: Math.max(...points.map(([, lat]) => lat)),
  };
});

function insideRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The San Francisco neighborhood containing a point, or null outside the city. */
export function sfNeighborhoodAt(lat: number, lng: number): string | null {
  for (const area of AREAS) {
    if (lng < area.minLng || lng > area.maxLng || lat < area.minLat || lat > area.maxLat) continue;
    const contains = area.polygons.some(
      ([outer, ...holes]) => insideRing(lng, lat, outer) && !holes.some((hole) => insideRing(lng, lat, hole)),
    );
    if (!contains) continue;
    if (area.name === 'Potrero Hill' && lng > DOGPATCH_WEST_LNG && lat < DOGPATCH_NORTH_LAT) return 'Dogpatch';
    return area.name;
  }
  return null;
}
