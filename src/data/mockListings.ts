import type { Listing, SourceId, NeighborhoodCommute } from '../types';
import type { Metro } from './metros';
import { SEARCH_SOURCES } from './sources';

// Seeded PRNG for deterministic results per metro
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const AMENITIES = [
  'In-Unit Laundry', 'Dishwasher', 'Central AC', 'Parking', 'Gym',
  'Pool', 'Rooftop', 'Doorman', 'Pet-Friendly', 'Balcony',
  'Hardwood Floors', 'Stainless Steel', 'Walk-In Closet', 'EV Charging',
  'Bike Storage', 'Concierge', 'Package Lockers', 'Coworking Space',
];

const GRADIENT_PAIRS: [string, string][] = [
  ['#1e3a5f', '#2d5a87'],
  ['#2d1b4e', '#4a2d7a'],
  ['#1a3c34', '#2d6b5a'],
  ['#3d1f1f', '#6b3333'],
  ['#1f2d3d', '#334d6b'],
  ['#2d2d1f', '#5a5a33'],
  ['#1b2d3d', '#2d4d6b'],
  ['#3d1f2d', '#6b334d'],
  ['#1f3d2d', '#336b4d'],
  ['#2d1f3d', '#4d336b'],
];

const SOURCE_INFO: { id: SourceId; name: string; color: string }[] = [
  { id: 'zillow', name: 'Zillow', color: '#006AFF' },
  { id: 'apartments', name: 'Apartments.com', color: '#6B46C1' },
  { id: 'craigslist', name: 'Craigslist', color: '#5C0E9F' },
  { id: 'trulia', name: 'Trulia', color: '#54B946' },
  { id: 'redfin', name: 'Redfin', color: '#A02021' },
];

function buildListingUrl(
  sourceId: SourceId,
  metro: Metro,
  neighborhood: string,
  bedrooms: number,
): string {
  const hoodSlug = neighborhood.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const source = SEARCH_SOURCES.find(s => s.id === sourceId);
  if (source) {
    return source.buildUrl({
      city: metro.city,
      state: metro.state,
      citySlug: metro.citySlug,
      region: metro.region,
      minRent: 0,
      maxRent: 99999,
      bedrooms: bedrooms === 0 ? 0 : bedrooms,
    });
  }
  // Fallback
  return `https://www.zillow.com/${metro.citySlug}-${metro.state.toLowerCase()}/rentals/?searchQueryState=%7B%22filterState%22%3A%7B%7D%7D&q=${hoodSlug}`;
}

export function generateListings(
  metro: Metro,
  neighborhoods: NeighborhoodCommute[],
  selectedNeighborhoods: string[] | null,
  bedrooms: number | null,
  minRent: number,
  maxRent: number,
): Listing[] {
  const rng = mulberry32(hashStr(metro.id));
  const listings: Listing[] = [];

  // Use selected neighborhoods or all
  const hoodNames = selectedNeighborhoods && selectedNeighborhoods.length > 0
    ? selectedNeighborhoods
    : metro.neighborhoods.map(n => n.name);

  const hoodCommuteMap = new Map(neighborhoods.map(n => [n.name, n]));

  for (const hoodName of hoodNames) {
    const hood = metro.neighborhoods.find(n => n.name === hoodName);
    if (!hood) continue;
    const commute = hoodCommuteMap.get(hoodName);

    // Generate 3-5 listings per neighborhood
    const count = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const beds = bedrooms !== null ? bedrooms : Math.floor(rng() * 4); // 0-3
      const baths = beds === 0 ? 1 : beds <= 1 ? 1 : (rng() > 0.5 ? beds : beds - 0.5);
      const basePrice = metro.basePrice[beds] ?? metro.basePrice[1] ?? 2000;
      const jitter = 0.85 + rng() * 0.3; // 0.85-1.15
      const price = Math.round((basePrice * hood.priceMultiplier * jitter) / 50) * 50;

      // Skip if outside rent range
      if (price < minRent || price > maxRent) continue;

      const sqft = beds === 0
        ? 350 + Math.floor(rng() * 200)
        : 500 + beds * 250 + Math.floor(rng() * 300);

      // Pick title: 60% building name, 40% "XBR on Street"
      const useBuilding = rng() > 0.4;
      const title = useBuilding
        ? metro.buildingNames[Math.floor(rng() * metro.buildingNames.length)]
        : (beds === 0 ? 'Studio' : `${beds}BR Apt`) + ' on ' + metro.streetNames[Math.floor(rng() * metro.streetNames.length)];

      // Street address
      const streetNum = 100 + Math.floor(rng() * 9900);
      const streetName = metro.streetNames[Math.floor(rng() * metro.streetNames.length)];
      const zip = metro.zipPrefix + String(100 + Math.floor(rng() * 900));
      const address = `${streetNum} ${streetName}, ${metro.city}, ${metro.state} ${zip}`;

      // Amenities: pick 3-6
      const amenCount = 3 + Math.floor(rng() * 4);
      const shuffled = [...AMENITIES].sort(() => rng() - 0.5);
      const amenities = shuffled.slice(0, amenCount);

      // Source
      const src = SOURCE_INFO[Math.floor(rng() * SOURCE_INFO.length)];

      // Gradient
      const grad = GRADIENT_PAIRS[Math.floor(rng() * GRADIENT_PAIRS.length)];

      const listing: Listing = {
        id: `${metro.id}-${hoodName}-${i}`,
        title,
        price,
        bedrooms: beds,
        bathrooms: baths,
        sqft,
        address,
        neighborhood: hoodName,
        amenities,
        sourceId: src.id,
        sourceName: src.name,
        sourceColor: src.color,
        url: buildListingUrl(src.id, metro, hoodName, beds),
        commuteMinutes: commute?.estimatedMinutes ?? 30,
        commuteColor: commute?.commuteColor ?? 'yellow',
        metroId: metro.id,
        gradientFrom: grad[0],
        gradientTo: grad[1],
      };

      listings.push(listing);
    }
  }

  return listings;
}
