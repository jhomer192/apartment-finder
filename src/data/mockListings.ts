import type { Listing } from '../types';

const SF_NEIGHBORHOODS: Array<{
  name: string;
  lat: number;
  lng: number;
  priceMultiplier: number;
}> = [
  { name: 'Mission District', lat: 37.7599, lng: -122.4148, priceMultiplier: 1.0 },
  { name: 'SOMA', lat: 37.7785, lng: -122.3950, priceMultiplier: 1.25 },
  { name: 'Pacific Heights', lat: 37.7925, lng: -122.4382, priceMultiplier: 1.5 },
  { name: 'Marina District', lat: 37.8015, lng: -122.4368, priceMultiplier: 1.4 },
  { name: 'Hayes Valley', lat: 37.7759, lng: -122.4245, priceMultiplier: 1.2 },
  { name: 'Nob Hill', lat: 37.7930, lng: -122.4161, priceMultiplier: 1.35 },
  { name: 'Russian Hill', lat: 37.8011, lng: -122.4194, priceMultiplier: 1.3 },
  { name: 'North Beach', lat: 37.8060, lng: -122.4103, priceMultiplier: 1.15 },
  { name: 'Castro', lat: 37.7609, lng: -122.4350, priceMultiplier: 1.1 },
  { name: 'Haight-Ashbury', lat: 37.7692, lng: -122.4481, priceMultiplier: 1.05 },
  { name: 'Inner Sunset', lat: 37.7601, lng: -122.4658, priceMultiplier: 0.85 },
  { name: 'Outer Sunset', lat: 37.7554, lng: -122.4950, priceMultiplier: 0.7 },
  { name: 'Richmond District', lat: 37.7800, lng: -122.4784, priceMultiplier: 0.8 },
  { name: 'Potrero Hill', lat: 37.7605, lng: -122.3926, priceMultiplier: 1.1 },
  { name: 'Dogpatch', lat: 37.7580, lng: -122.3870, priceMultiplier: 1.05 },
  { name: 'Tenderloin', lat: 37.7847, lng: -122.4141, priceMultiplier: 0.65 },
  { name: 'Financial District', lat: 37.7946, lng: -122.3999, priceMultiplier: 1.45 },
  { name: 'Japantown', lat: 37.7853, lng: -122.4296, priceMultiplier: 1.0 },
  { name: 'Noe Valley', lat: 37.7502, lng: -122.4337, priceMultiplier: 1.2 },
  { name: 'Glen Park', lat: 37.7340, lng: -122.4332, priceMultiplier: 0.9 },
];

const STREET_NAMES = [
  'Valencia St', 'Mission St', 'Folsom St', 'Howard St', 'Market St',
  'Divisadero St', 'Fillmore St', 'Haight St', 'Castro St', 'Church St',
  'Guerrero St', 'Dolores St', 'Sanchez St', 'Noe St', 'Bryant St',
  'Harrison St', 'Brannan St', 'Townsend St', 'King St', 'Berry St',
  'Van Ness Ave', 'Polk St', 'Larkin St', 'Hyde St', 'Leavenworth St',
  'Jones St', 'Taylor St', 'Mason St', 'Powell St', 'Stockton St',
  'Grant Ave', 'Columbus Ave', 'Broadway St', 'Green St', 'Union St',
  'Chestnut St', 'Lombard St', 'Bay St', 'Francisco St', 'Irving St',
  'Judah St', 'Kirkham St', 'Lawton St', 'Moraga St', 'Noriega St',
  'Ortega St', 'Pacheco St', 'Quintara St', 'Rivera St', 'Taraval St',
];

const BUILDING_NAMES = [
  'The Aria', 'Avalon', 'The Paramount', 'One Rincon', 'Jasper',
  'The Harrison', 'NEMA', 'Potrero 1010', 'The Gateway', 'Etta',
  'Hanover', 'Arc Light', 'The Linden', 'Solaire', '888 Seventh',
  'The Civic', 'AVA', 'The Martin', 'Channel Mission Bay', 'Archstone',
  'Duboce', 'The Fillmore Center', 'West Creek', 'Parkview', 'Skyline',
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
  'Classic San Francisco charm meets modern convenience. Victorian details with updated kitchen and bath.',
  'Move-in ready with fresh paint and new carpet. Centrally located near parks and public transit.',
  'Corner unit with cross-ventilation and abundant natural light. In-unit washer/dryer included.',
  'Luxury living with high-end finishes. Resort-style amenities including pool, gym, and rooftop lounge.',
  'Cozy and well-maintained in a great neighborhood. Walking distance to shops and BART station.',
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

function generateListing(index: number, rand: () => number): Listing {
  const hood = pick(SF_NEIGHBORHOODS, rand);
  const bedrooms = pick([0, 1, 1, 1, 2, 2, 2, 3, 3, 4], rand);
  const basePrices: Record<number, number> = {
    0: 1800, 1: 2400, 2: 3200, 3: 3900, 4: 4500,
  };
  const basePrice = basePrices[bedrooms] ?? 2400;
  const price = Math.round((basePrice * hood.priceMultiplier + (rand() - 0.5) * 600) / 50) * 50;
  const bathrooms = bedrooms === 0 ? 1 : bedrooms <= 2 ? pick([1, 1, 1.5, 2], rand) : pick([1.5, 2, 2, 2.5], rand);
  const baseSqft: Record<number, number> = {
    0: 450, 1: 650, 2: 950, 3: 1250, 4: 1600,
  };
  const sqft = Math.round(((baseSqft[bedrooms] ?? 650) + (rand() - 0.5) * 200) / 25) * 25;
  const streetNum = Math.floor(rand() * 3000) + 100;
  const street = pick(STREET_NAMES, rand);
  const source = pick(SOURCES, rand);
  const numAmenities = Math.floor(rand() * 8) + 2;
  const amenities = pickN(AMENITY_POOL, numAmenities, rand);

  const latJitter = (rand() - 0.5) * 0.008;
  const lngJitter = (rand() - 0.5) * 0.008;

  const hasName = rand() > 0.5;
  const buildingName = hasName ? pick(BUILDING_NAMES, rand) : null;
  const bedroomLabel = bedrooms === 0 ? 'Studio' : `${bedrooms}BR`;
  const title = buildingName
    ? `${buildingName} — ${bedroomLabel} in ${hood.name}`
    : `${bedroomLabel} Apartment on ${street}`;

  const daysAgo = Math.floor(rand() * 30);
  const datePosted = new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

  return {
    id: `mock-${source}-${index}`,
    source,
    title,
    address: `${streetNum} ${street}`,
    neighborhood: hood.name,
    city: 'San Francisco',
    state: 'CA',
    zip: `941${String(Math.floor(rand() * 30) + 10).padStart(2, '0')}`,
    lat: hood.lat + latJitter,
    lng: hood.lng + lngJitter,
    price: Math.max(1500, Math.min(4500, price)),
    bedrooms,
    bathrooms,
    sqft: Math.max(300, sqft),
    photoUrl: `https://picsum.photos/seed/${source}${index}/640/400`,
    amenities,
    description: pick(DESCRIPTIONS, rand),
    url: `https://${source}.com/listing/${index}`,
    datePosted,
  };
}

function generateDuplicates(listings: Listing[], rand: () => number): Listing[] {
  const duplicates: Listing[] = [];
  const numDupes = 8;
  for (let i = 0; i < numDupes; i++) {
    const original = listings[Math.floor(rand() * Math.min(40, listings.length))];
    const altSource = pick(SOURCES.filter(s => s !== original.source), rand);
    duplicates.push({
      ...original,
      id: `mock-${altSource}-dup-${i}`,
      source: altSource,
      url: `https://${altSource}.com/listing/dup-${i}`,
      // Slightly different price to simulate cross-site variation
      price: original.price + pick([-50, 0, 0, 25, 50], rand),
    });
  }
  return duplicates;
}

export function generateMockListings(): Listing[] {
  const rand = seededRandom(42);
  const listings: Listing[] = [];
  for (let i = 0; i < 55; i++) {
    listings.push(generateListing(i, rand));
  }
  const dupes = generateDuplicates(listings, rand);
  return [...listings, ...dupes];
}
