import { db } from './db.js';

/**
 * Everything here is public civic data about the block a listing sits on:
 * rail stops from OpenStreetMap, reported police incidents from DataSF, and
 * SFMTA parking meters. None of it is a judgement about a neighbourhood — the
 * UI shows the counts and their radius so a renter draws their own conclusion.
 */
export interface AreaFacts {
  /**
   * `walkMinutes` is null past `WALKABLE_M`: the distance is a straight line, so
   * over that range it may cross water or a hill and a walking figure would lie.
   */
  transit: { name: string; kind: RailKind; meters: number; walkMinutes: number | null } | null;
  /** Reported incidents within `radiusMeters` over the trailing year. */
  incidents: { count: number; radiusMeters: number; cityMedian: number } | null;
  /**
   * Violent-crime reports near the listing ranked against every other part of
   * the city. It is a rating of what gets reported here, not of whether a
   * renter will come to harm, and `quieterThanPercent` is what the grade means.
   */
  safety: {
    grade: SafetyGrade;
    violentCount: number;
    radiusMeters: number;
    quieterThanPercent: number;
  } | null;
  /** Metered on-street spaces, a proxy for how contested kerb space is. */
  parking: { meteredSpaces: number; radiusMeters: number } | null;
}

export type SafetyGrade = 'A' | 'B' | 'C' | 'D' | 'E';

/** "Muni rail" is a surface streetcar or light-rail stop rather than a Metro station. */
export type RailKind = 'BART' | 'Caltrain' | 'Muni Metro' | 'Muni rail';

interface RailStop {
  name: string;
  kind: RailKind;
  lat: number;
  lng: number;
}

interface GridCell {
  lat: number;
  lng: number;
  count: number;
}

const SF_BBOX = { south: 37.7, west: -122.53, north: 37.84, east: -122.34 };
const INCIDENT_RADIUS_M = 500;
const PARKING_RADIUS_M = 250;
/**
 * A 1.3 m/s pace covers 78m a minute, discounted here for streets that do not
 * run straight, since the distance we measure is a straight line.
 */
const WALK_METRES_PER_MINUTE = 60;
const WALKABLE_M = 2000;

/**
 * Crimes against a person, which is what someone asking whether a block is safe
 * means. Theft and vehicle break-ins dominate the raw feed and would otherwise
 * bury the signal under how busy a street is.
 */
const VIOLENT_CATEGORIES = [
  'Assault',
  'Robbery',
  'Homicide',
  'Rape',
  'Sex Offense',
  'Weapons Offense',
  'Weapons Offence',
  'Weapons Carrying Etc',
  'Human Trafficking (A), Commercial Sex Acts',
  'Human Trafficking (B), Involuntary Servitude',
  'Human Trafficking, Commercial Sex Acts',
];

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const INCIDENTS_URL = 'https://data.sfgov.org/resource/wg3w-h783.json';
const METERS_URL = 'https://data.sfgov.org/resource/8vzz-qzz9.json';

const RAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INCIDENT_TTL_MS = 24 * 60 * 60 * 1000;
const PARKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

db.exec(`
  CREATE TABLE IF NOT EXISTS area_cache (
    key        TEXT PRIMARY KEY,
    payload    TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  );
`);

/**
 * These feeds are third-party and occasionally down, and none of them are worth
 * failing a search over, so a cached copy outlives its TTL until a refresh works.
 */
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T | null> {
  const row = db.prepare('SELECT payload, fetched_at FROM area_cache WHERE key = ?').get(key) as
    | { payload: string; fetched_at: number }
    | undefined;
  if (row && Date.now() - row.fetched_at < ttlMs) {
    return JSON.parse(row.payload) as T;
  }

  try {
    const fresh = await load();
    db.prepare(
      `INSERT INTO area_cache (key, payload, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    ).run(key, JSON.stringify(fresh), Date.now());
    return fresh;
  } catch (error) {
    console.error(`area data "${key}" refresh failed:`, error instanceof Error ? error.message : error);
    return row ? (JSON.parse(row.payload) as T) : null;
  }
}

/**
 * These are open data APIs rather than sites that fight scrapers, so they get a
 * plain JSON request: the browser headers the listing sources use make Overpass
 * answer 406.
 */
async function fetchJson(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'apartment-finder (roommate housing search)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const latMetres = (aLat - bLat) * 111_320;
  const lngMetres = (aLng - bLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(latMetres ** 2 + lngMetres ** 2);
}

interface OverpassNode {
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

export function railKind(tags: Record<string, string>): RailKind | null {
  const operator = tags.operator ?? '';
  const network = tags.network ?? '';
  if (/Bay Area Rapid Transit/i.test(operator) || /BART/i.test(network)) return 'BART';
  // 22nd Street and Bayshore carry the line only on `network`, so operator alone loses them.
  if (/Peninsula Corridor|Caltrain/i.test(`${operator} ${network} ${tags.name ?? ''}`)) {
    return 'Caltrain';
  }
  if (/Municipal (Railway|Transportation)/i.test(operator)) {
    return tags.railway === 'tram_stop' ? 'Muni rail' : 'Muni Metro';
  }
  return null;
}

async function loadRailStops(): Promise<RailStop[]> {
  const query = `[out:json][timeout:60];(node["railway"~"^(station|halt|tram_stop)$"](${SF_BBOX.south},${SF_BBOX.west},${SF_BBOX.north},${SF_BBOX.east}););out body;`;
  const response = await fetchJson(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`, 60_000);
  if (!response.ok) throw new Error(`Overpass responded ${response.status}`);

  const body = (await response.json()) as { elements?: OverpassNode[] };
  const stops: RailStop[] = [];
  for (const node of body.elements ?? []) {
    const tags = node.tags ?? {};
    const name = tags.name;
    const kind = railKind(tags);
    if (!name || !kind || typeof node.lat !== 'number' || typeof node.lon !== 'number') continue;
    stops.push({ name, kind, lat: node.lat, lng: node.lon });
  }
  if (stops.length === 0) throw new Error('Overpass returned no rail stops');
  return stops;
}

async function loadGrid(url: string, where: string): Promise<GridCell[]> {
  const params = new URLSearchParams({
    // Three decimal places is roughly a 90m cell, finer than any radius we report.
    $select: 'round(latitude,3) as lat, round(longitude,3) as lng, count(*) as n',
    $where: where,
    $group: 'lat,lng',
    $limit: '50000',
  });
  const response = await fetchJson(`${url}?${params}`, 45_000);
  if (!response.ok) throw new Error(`DataSF responded ${response.status}`);

  const rows = (await response.json()) as { lat?: string; lng?: string; n?: string }[];
  const cells: GridCell[] = [];
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const count = Number(row.n);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(count)) continue;
    cells.push({ lat, lng, count });
  }
  if (cells.length === 0) throw new Error('DataSF returned no rows');
  return cells;
}

function trailingYearStart(): string {
  return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

/** Cells indexed by whole-hundredth of a degree, so a lookup scans a handful. */
export function indexCells(cells: GridCell[]): Map<string, GridCell[]> {
  const index = new Map<string, GridCell[]>();
  for (const cell of cells) {
    const key = `${cell.lat.toFixed(2)}:${cell.lng.toFixed(2)}`;
    index.set(key, [...(index.get(key) ?? []), cell]);
  }
  return index;
}

export function countWithin(index: Map<string, GridCell[]>, lat: number, lng: number, radius: number): number {
  let total = 0;
  // A hundredth of a degree is ~1.1km, so neighbouring buckets cover any radius we use.
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const bucket = index.get(`${(lat + dLat / 100).toFixed(2)}:${(lng + dLng / 100).toFixed(2)}`);
      for (const cell of bucket ?? []) {
        if (metresBetween(lat, lng, cell.lat, cell.lng) <= radius) total += cell.count;
      }
    }
  }
  return total;
}

/** Share of the city's blocks with strictly more reports than `count`. */
export function quieterThanPercent(sortedCounts: number[], count: number): number {
  if (sortedCounts.length === 0) return 0;
  let low = 0;
  let high = sortedCounts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedCounts[mid] <= count) low = mid + 1;
    else high = mid;
  }
  return Math.round(((sortedCounts.length - low) / sortedCounts.length) * 100);
}

export function safetyGrade(percent: number): SafetyGrade {
  if (percent >= 80) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 40) return 'C';
  if (percent >= 20) return 'D';
  return 'E';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

interface Datasets {
  rail: RailStop[] | null;
  incidents: { index: Map<string, GridCell[]>; cityMedian: number } | null;
  /** `cityCounts` is every block's violent total, sorted, so a listing can be ranked. */
  violent: { index: Map<string, GridCell[]>; cityCounts: number[] } | null;
  parking: Map<string, GridCell[]> | null;
}

let inFlight: Promise<Datasets> | null = null;

async function datasets(): Promise<Datasets> {
  inFlight ??= (async () => {
    const violentList = VIOLENT_CATEGORIES.map((category) => `'${category}'`).join(',');
    const [rail, incidentCells, violentCells, meterCells] = await Promise.all([
      cached<RailStop[]>('rail-stops-v2', RAIL_TTL_MS, loadRailStops),
      cached<GridCell[]>('incidents', INCIDENT_TTL_MS, () =>
        loadGrid(INCIDENTS_URL, `incident_datetime > '${trailingYearStart()}' AND latitude IS NOT NULL`),
      ),
      cached<GridCell[]>('violent-incidents', INCIDENT_TTL_MS, () =>
        loadGrid(
          INCIDENTS_URL,
          `incident_datetime > '${trailingYearStart()}' AND latitude IS NOT NULL` +
            ` AND incident_category in (${violentList})`,
        ),
      ),
      cached<GridCell[]>('parking-meters', PARKING_TTL_MS, () =>
        loadGrid(METERS_URL, "latitude IS NOT NULL AND active_meter_flag='M'"),
      ),
    ]);

    let incidents: Datasets['incidents'] = null;
    if (incidentCells) {
      const index = indexCells(incidentCells);
      // The typical block, so a listing's count reads as "quieter" or "busier"
      // than the rest of the city rather than as a bare number.
      const cityMedian = median(
        incidentCells.map((cell) => countWithin(index, cell.lat, cell.lng, INCIDENT_RADIUS_M)),
      );
      incidents = { index, cityMedian };
    }

    let violent: Datasets['violent'] = null;
    if (violentCells) {
      const index = indexCells(violentCells);
      const cityCounts = violentCells
        .map((cell) => countWithin(index, cell.lat, cell.lng, INCIDENT_RADIUS_M))
        .sort((a, b) => a - b);
      violent = { index, cityCounts };
    }

    return { rail, incidents, violent, parking: meterCells ? indexCells(meterCells) : null };
  })();

  // A failed refresh must not poison later searches.
  return inFlight.catch((error) => {
    inFlight = null;
    throw error;
  });
}

/** Warms the caches so the first search of the day is not the one that waits. */
export async function primeAreaData(): Promise<void> {
  await datasets().catch(() => undefined);
}

export async function areaFactsFor(lat: number | null, lng: number | null): Promise<AreaFacts | null> {
  if (lat === null || lng === null) return null;

  let data: Datasets;
  try {
    data = await datasets();
  } catch {
    return null;
  }

  let transit: AreaFacts['transit'] = null;
  let nearest: { stop: RailStop; metres: number } | null = null;
  for (const stop of data.rail ?? []) {
    const metres = metresBetween(lat, lng, stop.lat, stop.lng);
    if (!nearest || metres < nearest.metres) nearest = { stop, metres };
  }
  if (nearest) {
    transit = {
      name: nearest.stop.name,
      kind: nearest.stop.kind,
      meters: Math.round(nearest.metres),
      walkMinutes:
        nearest.metres <= WALKABLE_M
          ? Math.max(1, Math.round(nearest.metres / WALK_METRES_PER_MINUTE))
          : null,
    };
  }

  let safety: AreaFacts['safety'] = null;
  if (data.violent) {
    const violentCount = countWithin(data.violent.index, lat, lng, INCIDENT_RADIUS_M);
    const percent = quieterThanPercent(data.violent.cityCounts, violentCount);
    safety = {
      grade: safetyGrade(percent),
      violentCount,
      radiusMeters: INCIDENT_RADIUS_M,
      quieterThanPercent: percent,
    };
  }

  return {
    transit,
    safety,
    incidents: data.incidents
      ? {
          count: countWithin(data.incidents.index, lat, lng, INCIDENT_RADIUS_M),
          radiusMeters: INCIDENT_RADIUS_M,
          cityMedian: data.incidents.cityMedian,
        }
      : null,
    parking: data.parking
      ? {
          meteredSpaces: countWithin(data.parking, lat, lng, PARKING_RADIUS_M),
          radiusMeters: PARKING_RADIUS_M,
        }
      : null,
  };
}
