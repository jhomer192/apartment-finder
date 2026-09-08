import { kmBetween, travelMinutes } from './tours.js';

export interface Point {
  lat: number;
  lng: number;
}

export interface Leg {
  km: number;
  minutes: number;
}

export type MatrixSource = 'osrm' | 'estimate';

export interface DriveMatrix {
  /** legs[i][j] is the drive from point i to point j; the diagonal is zero. */
  legs: Leg[][];
  source: MatrixSource;
}

const OSRM = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
const TIMEOUT_MS = 8000;
/** Sunday traffic is light, but nobody drives OSRM's free-flow speeds through SF. */
const TRAFFIC_FACTOR = 1.15;
const PARKING_MINUTES = 5;

function legFromEstimate(a: Point, b: Point): Leg {
  const km = kmBetween(a, b) ?? 0;
  return { km, minutes: km === 0 ? 0 : travelMinutes(km) };
}

function estimateMatrix(points: Point[]): DriveMatrix {
  return {
    legs: points.map((a) => points.map((b) => (a === b ? { km: 0, minutes: 0 } : legFromEstimate(a, b)))),
    source: 'estimate',
  };
}

interface TableResponse {
  code: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
}

/**
 * Real road distance and time between every pair of points, from OSRM's public
 * routing; falls back to the straight-line estimate when it is unreachable so a
 * plan always comes back. Public OSRM allows 100 points per table.
 */
export async function driveMatrix(points: Point[], fetcher: typeof fetch = fetch): Promise<DriveMatrix> {
  if (points.length < 2) return estimateMatrix(points);
  if (points.length > 100) return estimateMatrix(points);
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const url = `${OSRM}/table/v1/driving/${coords}?annotations=duration,distance`;
  try {
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'apartment-finder tour planner' },
    });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const table = (await response.json()) as TableResponse;
    if (table.code !== 'Ok' || !table.durations || !table.distances) throw new Error(`OSRM ${table.code}`);
    const legs = points.map((a, i) =>
      points.map((b, j) => {
        if (i === j) return { km: 0, minutes: 0 };
        const seconds = table.durations?.[i]?.[j];
        const meters = table.distances?.[i]?.[j];
        if (seconds === null || seconds === undefined || meters === null || meters === undefined) {
          return legFromEstimate(a, b);
        }
        return {
          km: Math.round(meters / 10) / 100,
          minutes: Math.ceil((seconds / 60) * TRAFFIC_FACTOR) + PARKING_MINUTES,
        };
      }),
    );
    return { legs, source: 'osrm' };
  } catch (error) {
    console.warn('OSRM unavailable, using straight-line estimate:', error instanceof Error ? error.message : error);
    return estimateMatrix(points);
  }
}

/**
 * Two-opt on an open path: reverse any segment that shortens the total drive
 * until nothing does. When `fixedStart` is set the first index never moves, so
 * the day still begins where the group is leaving from.
 */
export function improvePath(order: number[], legs: Leg[][], fixedStart: boolean): number[] {
  const path = [...order];
  const first = fixedStart ? 1 : 0;
  const cost = (a: number, b: number) => legs[a][b].minutes;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = first; i < path.length - 1; i += 1) {
      for (let j = i + 1; j < path.length; j += 1) {
        const before = (i > 0 ? cost(path[i - 1], path[i]) : 0) + (j < path.length - 1 ? cost(path[j], path[j + 1]) : 0);
        const after = (i > 0 ? cost(path[i - 1], path[j]) : 0) + (j < path.length - 1 ? cost(path[i], path[j + 1]) : 0);
        if (after < before) {
          path.splice(i, j - i + 1, ...path.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return path;
}

export function pathMinutes(path: number[], legs: Leg[][]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += legs[path[i - 1]][path[i]].minutes;
  return total;
}
