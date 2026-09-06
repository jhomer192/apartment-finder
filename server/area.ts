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
  /**
   * Reported incidents within `radiusMeters` over the trailing year, as a rate
   * against the residents living in that radius so a dense block is not marked
   * down for holding more people.
   */
  incidents: {
    count: number;
    residents: number;
    ratePer100k: number;
    cityRatePer100k: number;
    radiusMeters: number;
  } | null;
  /**
   * Violent-crime reports per 100k residents near the listing, ranked against
   * every other part of the city. It is a rating of what gets reported here,
   * not of whether a renter will come to harm, and `quieterThanPercent` is
   * what the grade means.
   */
  safety: {
    grade: SafetyGrade;
    violentCount: number;
    residents: number;
    ratePer100k: number;
    cityRatePer100k: number;
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

/** The main instance sheds load with a 504 often enough to be worth a mirror. */
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const INCIDENTS_URL = 'https://data.sfgov.org/resource/wg3w-h783.json';
const METERS_URL = 'https://data.sfgov.org/resource/8vzz-qzz9.json';
/** Census 2020 blocks: population with an interior point, so it grids like the rest. */
const POPULATION_URL = 'https://data.sfgov.org/resource/p2fw-hsrv.json';

/**
 * Below this many residents in the radius a rate is arithmetic noise — one
 * report in a 30-person industrial block reads as 3,333 per 100k — so those
 * listings get no rating rather than a false alarm.
 */
const MIN_RESIDENTS_FOR_RATE = 200;

/** Bumped when the parsing changes, so cached stops are refetched rather than trusted. */
const RAIL_KEY = 'rail-stops-v2';
const RAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INCIDENT_TTL_MS = 24 * 60 * 60 * 1000;
const PARKING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Decennial census: it does not change between deployments. */
const POPULATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

/** Whatever a key last held, however old, for falling back across a key rename. */
function lastCached<T>(key: string): T | null {
  const row = db.prepare('SELECT payload FROM area_cache WHERE key = ?').get(key) as
    | { payload: string }
    | undefined;
  return row ? (JSON.parse(row.payload) as T) : null;
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

  let body: { elements?: OverpassNode[] } | null = null;
  let failure = 'no Overpass endpoint tried';
  for (const endpoint of OVERPASS_URLS) {
    try {
      const response = await fetchJson(`${endpoint}?data=${encodeURIComponent(query)}`, 60_000);
      if (!response.ok) {
        failure = `Overpass responded ${response.status}`;
        continue;
      }
      body = (await response.json()) as { elements?: OverpassNode[] };
      break;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  }
  if (!body) throw new Error(failure);

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

/**
 * The census feed publishes one row per block with its own interior point, so
 * it needs no rounding: the block centroid *is* the cell.
 */
async function loadPopulation(): Promise<GridCell[]> {
  const params = new URLSearchParams({
    $select: 'intptlat20, intptlon20, pop20',
    $where: 'pop20 > 0',
    $limit: '20000',
  });
  const response = await fetchJson(`${POPULATION_URL}?${params}`, 45_000);
  if (!response.ok) throw new Error(`DataSF responded ${response.status}`);

  const rows = (await response.json()) as { intptlat20?: string; intptlon20?: string; pop20?: string }[];
  const cells: GridCell[] = [];
  for (const row of rows) {
    const lat = Number(row.intptlat20);
    const lng = Number(row.intptlon20);
    const count = Number(row.pop20);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(count)) continue;
    cells.push({ lat, lng, count });
  }
  if (cells.length === 0) throw new Error('DataSF returned no census blocks');
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

/**
 * Reports per 100k residents, or null where too few people live in the radius
 * for the division to mean anything.
 */
export function ratePer100k(count: number, residents: number): number | null {
  if (residents < MIN_RESIDENTS_FOR_RATE) return null;
  return Math.round((count / residents) * 100_000);
}

/** Share of the city's blocks with a strictly higher rate than `rate`. */
export function quieterThanPercent(sortedRates: number[], rate: number): number {
  if (sortedRates.length === 0) return 0;
  let low = 0;
  let high = sortedRates.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedRates[mid] <= rate) low = mid + 1;
    else high = mid;
  }
  return Math.round(((sortedRates.length - low) / sortedRates.length) * 100);
}

/**
 * Grades on the rate against the citywide rate rather than on the percentile:
 * ranking against 500m circles drawn on residential blocks makes the typical
 * block look good, so a place at the city average scored a D and read as a
 * warning next to text saying it matched the city.
 */
export function safetyGrade(rate: number, cityRate: number): SafetyGrade {
  if (cityRate <= 0) return 'C';
  const ratio = rate / cityRate;
  if (ratio <= 0.5) return 'A';
  if (ratio <= 0.9) return 'B';
  if (ratio <= 1.5) return 'C';
  if (ratio <= 3) return 'D';
  return 'E';
}

/** Reports per 100k across the whole city, which is what a block is compared to. */
function cityRate(cells: GridCell[], population: GridCell[]): number {
  const residents = population.reduce((total, cell) => total + cell.count, 0);
  const reports = cells.reduce((total, cell) => total + cell.count, 0);
  return residents > 0 ? Math.round((reports / residents) * 100_000) : 0;
}

interface Datasets {
  rail: RailStop[] | null;
  population: Map<string, GridCell[]> | null;
  incidents: { index: Map<string, GridCell[]>; cityRatePer100k: number } | null;
  /** `cityRates` is every populated block's violent rate, sorted, so a listing can be ranked. */
  violent: {
    index: Map<string, GridCell[]>;
    cityRates: number[];
    cityRatePer100k: number;
  } | null;
  parking: Map<string, GridCell[]> | null;
}

let inFlight: Promise<Datasets> | null = null;

async function datasets(): Promise<Datasets> {
  inFlight ??= (async () => {
    const violentList = VIOLENT_CATEGORIES.map((category) => `'${category}'`).join(',');
    const [rail, populationCells, incidentCells, violentCells, meterCells] = await Promise.all([
      cached<RailStop[]>(RAIL_KEY, RAIL_TTL_MS, loadRailStops).then(
        // Overpass answers 504 often enough that a new key must not leave a
        // deployment with no stops at all while the older copy is still on disk.
        (stops) => stops ?? lastCached<RailStop[]>('rail-stops'),
      ),
      cached<GridCell[]>('census-population', POPULATION_TTL_MS, loadPopulation),
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

    // Rates need a denominator, so without the census the crime layers stay dark
    // rather than falling back to raw counts the UI would present as a rating.
    const population = populationCells ? indexCells(populationCells) : null;

    let incidents: Datasets['incidents'] = null;
    if (incidentCells && populationCells) {
      incidents = {
        index: indexCells(incidentCells),
        cityRatePer100k: cityRate(incidentCells, populationCells),
      };
    }

    let violent: Datasets['violent'] = null;
    if (violentCells && populationCells && population) {
      const index = indexCells(violentCells);
      // Every populated block's own rate, so a listing is ranked against places
      // people actually live rather than against downtown's daytime crowd.
      const cityRates = populationCells
        .map((cell) =>
          ratePer100k(
            countWithin(index, cell.lat, cell.lng, INCIDENT_RADIUS_M),
            countWithin(population, cell.lat, cell.lng, INCIDENT_RADIUS_M),
          ),
        )
        .filter((rate): rate is number => rate !== null)
        .sort((a, b) => a - b);
      violent = { index, cityRates, cityRatePer100k: cityRate(violentCells, populationCells) };
    }

    return {
      rail,
      population,
      incidents,
      violent,
      parking: meterCells ? indexCells(meterCells) : null,
    };
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

  const residents = data.population
    ? countWithin(data.population, lat, lng, INCIDENT_RADIUS_M)
    : 0;

  let safety: AreaFacts['safety'] = null;
  if (data.violent) {
    const violentCount = countWithin(data.violent.index, lat, lng, INCIDENT_RADIUS_M);
    const rate = ratePer100k(violentCount, residents);
    if (rate !== null) {
      const percent = quieterThanPercent(data.violent.cityRates, rate);
      safety = {
        grade: safetyGrade(rate, data.violent.cityRatePer100k),
        violentCount,
        residents,
        ratePer100k: rate,
        cityRatePer100k: data.violent.cityRatePer100k,
        radiusMeters: INCIDENT_RADIUS_M,
        quieterThanPercent: percent,
      };
    }
  }

  let incidents: AreaFacts['incidents'] = null;
  if (data.incidents) {
    const count = countWithin(data.incidents.index, lat, lng, INCIDENT_RADIUS_M);
    const rate = ratePer100k(count, residents);
    if (rate !== null) {
      incidents = {
        count,
        residents,
        ratePer100k: rate,
        cityRatePer100k: data.incidents.cityRatePer100k,
        radiusMeters: INCIDENT_RADIUS_M,
      };
    }
  }

  return {
    transit,
    safety,
    incidents,
    parking: data.parking
      ? {
          meteredSpaces: countWithin(data.parking, lat, lng, PARKING_RADIUS_M),
          radiusMeters: PARKING_RADIUS_M,
        }
      : null,
  };
}
