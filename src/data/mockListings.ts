import type { Listing } from '../types';
import { METROS } from './metros';
import type { Metro, Neighborhood } from './metros';

// ── Real Unsplash apartment photo IDs ───────────────────────
const APARTMENT_PHOTOS = [
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502672260-1e0b4029a5c7?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1560185893-a5e827cf24e5?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600585154-0ecb13263544?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f7e6?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1522708323590-b9a634b6a6a?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600566753-e7a32ff846af?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600573472-232eea51e4a7?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1574362848-4bedc31f94af?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600210492-b2daf0a1f02c?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600585152-3c99b77b12b4?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1560449752-d3f1f2e91187?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600047509-579d6df4a0cd?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600607688-bca6a3979651?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1564078290-57e8f0e085c4?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600566752-59f6a6b4efef?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600210491-5be30ee71bbb?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1560185127-6a4f1b9a3b3e?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600585153-086e4f9a0f8c?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600047508-b5d6a3c7f50e?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502672023-a5f9ef83ab10?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1560448075-25ab0e46e4be?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1600573473-232eea51e4a8?w=640&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1574362849-4bedc31f94b0?w=640&h=400&fit=crop&auto=format',
];

const AMENITY_POOL = [
  'In-unit laundry', 'Shared laundry', 'Parking included', 'Garage parking',
  'Pet-friendly', 'Cats only', 'Gym', 'Pool', 'Rooftop deck',
  'Doorman', 'Elevator', 'Dishwasher', 'Central AC', 'Hardwood floors',
  'Balcony', 'Walk-in closet', 'Stainless steel appliances',
  'Granite countertops', 'EV charging', 'Bike storage',
  'Package lockers', 'Concierge', 'Business center', 'Dog run',
];

const DESCRIPTIONS = [
  'Stunning apartment in a beautifully maintained building. Natural light floods through oversized windows.',
  'Modern finishes throughout with an open-concept floor plan. Steps from cafes, restaurants, and transit.',
  'Recently renovated with designer touches. Chef\'s kitchen with quartz countertops and premium appliances.',
  'Spacious layout with generous closet space. Building features 24/7 security and maintained common areas.',
  'Top-floor unit with panoramic city views. Quiet and bright, perfect for working from home.',
  'Classic charm meets modern convenience. Original details with updated kitchen and bath.',
  'Move-in ready with fresh paint and new carpet. Centrally located near parks and public transit.',
  'Corner unit with cross-ventilation and abundant natural light. In-unit washer/dryer included.',
  'Luxury living with high-end finishes. Resort-style amenities including pool, gym, and rooftop lounge.',
  'Cozy and well-maintained in a great neighborhood. Walking distance to shops and transit.',
];

const SOURCES = ['zillow', 'apartments.com', 'craigslist', 'trulia', 'redfin'];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rand: () => number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

function generateListing(
  index: number,
  globalIndex: number,
  metro: Metro,
  hood: Neighborhood,
  rand: () => number,
): Listing {
  const bedrooms = pick([0, 1, 1, 1, 2, 2, 2, 3, 3, 4], rand);
  const basePrice = metro.basePrice[bedrooms] ?? 2400;
  const price = Math.round((basePrice * hood.priceMultiplier + (rand() - 0.5) * 600) / 50) * 50;
  const bathrooms = bedrooms === 0 ? 1 : bedrooms <= 2 ? pick([1, 1, 1.5, 2], rand) : pick([1.5, 2, 2, 2.5], rand);
  const baseSqft: Record<number, number> = {
    0: 450, 1: 650, 2: 950, 3: 1250, 4: 1600,
  };
  const sqft = Math.round(((baseSqft[bedrooms] ?? 650) + (rand() - 0.5) * 200) / 25) * 25;
  const streetNum = Math.floor(rand() * 3000) + 100;
  const street = pick(metro.streetNames, rand);
  const source = pick(SOURCES, rand);
  const numAmenities = Math.floor(rand() * 8) + 2;
  const amenities = pickN(AMENITY_POOL, numAmenities, rand);

  const latJitter = (rand() - 0.5) * 0.008;
  const lngJitter = (rand() - 0.5) * 0.008;

  const hasName = rand() > 0.5;
  const buildingName = hasName ? pick(metro.buildingNames, rand) : null;
  const bedroomLabel = bedrooms === 0 ? 'Studio' : `${bedrooms}BR`;
  const title = buildingName
    ? `${buildingName} — ${bedroomLabel} in ${hood.name}`
    : `${bedroomLabel} Apartment on ${street}`;

  const daysAgo = Math.floor(rand() * 30);
  const datePosted = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

  // Determine city name from neighborhood + metro
  const city = deriveCityName(metro, hood);

  return {
    id: `mock-${source}-${metro.id}-${index}`,
    source,
    title,
    address: `${streetNum} ${street}`,
    neighborhood: hood.name,
    city,
    metro: metro.id,
    state: metro.state,
    zip: `${metro.zipPrefix}${String(Math.floor(rand() * 900) + 100)}`,
    lat: hood.lat + latJitter,
    lng: hood.lng + lngJitter,
    price: Math.max(800, price),
    bedrooms,
    bathrooms,
    sqft: Math.max(300, sqft),
    photoUrl: APARTMENT_PHOTOS[globalIndex % APARTMENT_PHOTOS.length],
    amenities,
    description: pick(DESCRIPTIONS, rand),
    url: `https://${source}.com/listing/${metro.id}-${index}`,
    datePosted,
  };
}

/** Derive a human-readable city name from metro + neighborhood */
function deriveCityName(metro: Metro, hood: Neighborhood): string {
  if (metro.id === 'bay-area') {
    const oaklandHoods = ['Temescal', 'Rockridge', 'Lake Merritt', 'Jack London Square'];
    const sjHoods = ['Downtown San Jose', 'Willow Glen', 'Santana Row'];
    if (oaklandHoods.includes(hood.name)) return 'Oakland';
    if (sjHoods.includes(hood.name)) return 'San Jose';
    if (hood.name === 'Berkeley') return 'Berkeley';
    if (hood.name === 'Palo Alto') return 'Palo Alto';
    if (hood.name === 'Mountain View') return 'Mountain View';
    if (hood.name === 'Sunnyvale') return 'Sunnyvale';
    return 'San Francisco';
  }
  if (metro.id === 'los-angeles') return hood.name === 'Long Beach' ? 'Long Beach' : 'Los Angeles';
  if (metro.id === 'new-york') {
    const bkHoods = ['Williamsburg', 'Park Slope', 'DUMBO', 'Bushwick', 'Crown Heights', 'Bed-Stuy', 'Greenpoint'];
    const qnHoods = ['Astoria', 'Long Island City', 'Jackson Heights'];
    if (bkHoods.includes(hood.name)) return 'Brooklyn';
    if (qnHoods.includes(hood.name)) return 'Queens';
    return 'New York';
  }
  if (metro.id === 'dc-metro') {
    const dcHoods = ['Dupont Circle', 'Adams Morgan', 'Capitol Hill', 'Georgetown', 'Navy Yard', 'Shaw', 'U Street', 'Logan Circle', 'Columbia Heights'];
    const arlingtonHoods = ['Clarendon', 'Ballston', 'Crystal City', 'Rosslyn'];
    const alexHoods = ['Old Town Alexandria', 'Del Ray'];
    if (dcHoods.includes(hood.name)) return 'Washington';
    if (arlingtonHoods.includes(hood.name)) return 'Arlington';
    if (alexHoods.includes(hood.name)) return 'Alexandria';
    if (hood.name === 'Falls Church') return 'Falls Church';
    if (hood.name === 'Tysons') return 'Tysons';
    if (hood.name === 'Reston') return 'Reston';
    return 'Washington';
  }
  return metro.name;
}

function generateDuplicates(listings: Listing[], rand: () => number): Listing[] {
  const duplicates: Listing[] = [];
  const numDupes = Math.min(8, Math.floor(listings.length * 0.1));
  for (let i = 0; i < numDupes; i++) {
    const original = listings[Math.floor(rand() * Math.min(40, listings.length))];
    const altSource = pick(SOURCES.filter(s => s !== original.source), rand);
    duplicates.push({
      ...original,
      id: `mock-${altSource}-dup-${i}`,
      source: altSource,
      url: `https://${altSource}.com/listing/dup-${i}`,
      price: original.price + pick([-50, 0, 0, 25, 50], rand),
    });
  }
  return duplicates;
}

/**
 * Generate mock listings for the given metro IDs.
 * ~40 listings per metro, plus cross-site duplicates.
 */
export function generateMockListings(metroIds?: string[]): Listing[] {
  const rand = seededRandom(42);
  const listings: Listing[] = [];
  let globalIndex = 0;

  const selectedMetros = metroIds && metroIds.length > 0
    ? METROS.filter(m => metroIds.includes(m.id))
    : METROS;

  for (const metro of selectedMetros) {
    const listingsPerMetro = 40;
    for (let i = 0; i < listingsPerMetro; i++) {
      const hood = metro.neighborhoods[i % metro.neighborhoods.length];
      listings.push(generateListing(i, globalIndex, metro, hood, rand));
      globalIndex++;
    }
  }

  const dupes = generateDuplicates(listings, rand);
  return [...listings, ...dupes];
}
