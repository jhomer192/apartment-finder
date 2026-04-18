export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  priceMultiplier: number;
}

export interface Metro {
  id: string;
  name: string;
  state: string;
  basePrice: Record<number, number>; // bedrooms -> base rent
  defaultOffice: { lat: number; lng: number; label: string };
  neighborhoods: Neighborhood[];
  streetNames: string[];
  buildingNames: string[];
  zipPrefix: string;
}

export const METROS: Metro[] = [
  // ── Bay Area ──────────────────────────────────────────────
  {
    id: 'bay-area',
    name: 'Bay Area',
    state: 'CA',
    basePrice: { 0: 2200, 1: 2900, 2: 3800, 3: 4600, 4: 5400 },
    defaultOffice: { lat: 37.7897, lng: -122.3972, label: 'Salesforce Tower' },
    zipPrefix: '94',
    streetNames: [
      'Valencia St', 'Mission St', 'Folsom St', 'Howard St', 'Market St',
      'Divisadero St', 'Fillmore St', 'Haight St', 'Castro St', 'Church St',
      'Guerrero St', 'Dolores St', 'Van Ness Ave', 'Polk St', 'Hyde St',
      'Columbus Ave', 'Broadway St', 'Union St', 'Chestnut St', 'Irving St',
      'Telegraph Ave', 'College Ave', 'Grand Ave', 'Lakeshore Ave',
      'University Ave', 'Shattuck Ave', 'San Carlos St', 'El Camino Real',
      'Castro St', 'Stevens Creek Blvd', 'Santana Row',
    ],
    buildingNames: [
      'The Aria', 'Avalon', 'The Paramount', 'One Rincon', 'Jasper',
      'NEMA', 'Potrero 1010', 'The Gateway', 'Etta', 'Arc Light',
      'The Linden', 'Solaire', 'The Civic', 'AVA', 'The Martin',
      'The Grand', 'Skylyne', 'Elan', 'Park Vue', 'Mosaic',
    ],
    neighborhoods: [
      // San Francisco
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
      { name: 'Noe Valley', lat: 37.7502, lng: -122.4337, priceMultiplier: 1.2 },
      { name: 'Glen Park', lat: 37.7340, lng: -122.4332, priceMultiplier: 0.9 },
      // Oakland
      { name: 'Temescal', lat: 37.8360, lng: -122.2608, priceMultiplier: 0.8 },
      { name: 'Rockridge', lat: 37.8446, lng: -122.2516, priceMultiplier: 0.9 },
      { name: 'Lake Merritt', lat: 37.8044, lng: -122.2603, priceMultiplier: 0.75 },
      { name: 'Jack London Square', lat: 37.7955, lng: -122.2789, priceMultiplier: 0.85 },
      // San Jose
      { name: 'Downtown San Jose', lat: 37.3382, lng: -121.8863, priceMultiplier: 0.85 },
      { name: 'Willow Glen', lat: 37.3088, lng: -121.9065, priceMultiplier: 0.9 },
      { name: 'Santana Row', lat: 37.3209, lng: -121.9479, priceMultiplier: 1.0 },
      // Other
      { name: 'Berkeley', lat: 37.8716, lng: -122.2727, priceMultiplier: 0.85 },
      { name: 'Palo Alto', lat: 37.4419, lng: -122.1430, priceMultiplier: 1.3 },
      { name: 'Mountain View', lat: 37.3861, lng: -122.0839, priceMultiplier: 1.15 },
      { name: 'Sunnyvale', lat: 37.3688, lng: -122.0363, priceMultiplier: 1.05 },
    ],
  },

  // ── Los Angeles ───────────────────────────────────────────
  {
    id: 'los-angeles',
    name: 'Los Angeles',
    state: 'CA',
    basePrice: { 0: 1800, 1: 2400, 2: 3200, 3: 3900, 4: 4600 },
    defaultOffice: { lat: 34.0522, lng: -118.2437, label: 'Downtown LA' },
    zipPrefix: '90',
    streetNames: [
      'Sunset Blvd', 'Hollywood Blvd', 'Wilshire Blvd', 'Santa Monica Blvd',
      'Melrose Ave', 'La Brea Ave', 'Fairfax Ave', 'Vermont Ave',
      'Western Ave', 'Vine St', 'Highland Ave', 'Beverly Blvd',
      'Olympic Blvd', 'Pico Blvd', 'Venice Blvd', 'La Cienega Blvd',
      'Robertson Blvd', 'Figueroa St', 'Broadway', 'Spring St',
      'Main St', 'Ocean Ave', 'Lincoln Blvd', 'Abbot Kinney Blvd',
      'Montana Ave', 'Colorado Blvd', 'Lake Ave', 'Brand Blvd',
    ],
    buildingNames: [
      'The Emerson', 'Wilshire La Brea', 'The Vermont', 'NMS La Cienega',
      'Essex on the Park', 'Eighth & Grand', 'Metropolis', 'Circa',
      'The Kelvin', 'The Lorenzo', 'Elan', 'Vox', 'Ten50', 'Argyle House',
      'The Chadwick', 'The Walden', 'Pegasus', 'The Dylan', 'Domain',
    ],
    neighborhoods: [
      { name: 'Downtown LA', lat: 34.0407, lng: -118.2468, priceMultiplier: 1.1 },
      { name: 'Santa Monica', lat: 34.0195, lng: -118.4912, priceMultiplier: 1.5 },
      { name: 'Venice', lat: 33.9850, lng: -118.4695, priceMultiplier: 1.4 },
      { name: 'Silver Lake', lat: 34.0869, lng: -118.2702, priceMultiplier: 1.15 },
      { name: 'Echo Park', lat: 34.0782, lng: -118.2606, priceMultiplier: 1.0 },
      { name: 'West Hollywood', lat: 34.0900, lng: -118.3617, priceMultiplier: 1.35 },
      { name: 'Koreatown', lat: 34.0578, lng: -118.3016, priceMultiplier: 0.8 },
      { name: 'Culver City', lat: 34.0211, lng: -118.3965, priceMultiplier: 1.1 },
      { name: 'Pasadena', lat: 34.1478, lng: -118.1445, priceMultiplier: 1.05 },
      { name: 'Hollywood', lat: 34.0928, lng: -118.3287, priceMultiplier: 1.1 },
      { name: 'Beverly Hills', lat: 34.0736, lng: -118.4004, priceMultiplier: 1.7 },
      { name: 'Westwood', lat: 34.0635, lng: -118.4455, priceMultiplier: 1.3 },
      { name: 'Burbank', lat: 34.1808, lng: -118.3090, priceMultiplier: 0.9 },
      { name: 'Long Beach', lat: 33.7701, lng: -118.1937, priceMultiplier: 0.75 },
      { name: 'Glendale', lat: 34.1425, lng: -118.2551, priceMultiplier: 0.95 },
    ],
  },

  // ── New York ──────────────────────────────────────────────
  {
    id: 'new-york',
    name: 'New York',
    state: 'NY',
    basePrice: { 0: 2600, 1: 3400, 2: 4500, 3: 5800, 4: 7000 },
    defaultOffice: { lat: 40.7580, lng: -73.9855, label: 'Midtown Manhattan' },
    zipPrefix: '10',
    streetNames: [
      'Broadway', 'Park Ave', 'Madison Ave', 'Lexington Ave', '5th Ave',
      'Amsterdam Ave', 'Columbus Ave', 'West End Ave', 'Riverside Dr',
      'Bedford Ave', 'Smith St', 'Court St', 'Atlantic Ave', 'Flatbush Ave',
      'Dekalb Ave', 'Myrtle Ave', 'Fulton St', 'Bleecker St', 'Houston St',
      'Canal St', 'Delancey St', 'Spring St', 'Prince St', 'Greene St',
      'Bowery', 'Elizabeth St', 'Mulberry St', 'Grand St', 'Orchard St',
    ],
    buildingNames: [
      'The Rockwell', 'Avalon Bowery', 'The Lyric', 'One Manhattan Square',
      'The Eugene', 'Gramercy Square', 'Sky', 'The Forge', 'Greenpoint Landing',
      'The Brooklyner', 'Forte', 'The Ashland', 'Denizen', 'The Dime',
      '1 QPS Tower', 'Hunters Point South', 'The Jackson', 'Gotham West',
    ],
    neighborhoods: [
      // Manhattan
      { name: 'Upper East Side', lat: 40.7736, lng: -73.9566, priceMultiplier: 1.3 },
      { name: 'Upper West Side', lat: 40.7870, lng: -73.9754, priceMultiplier: 1.25 },
      { name: 'Chelsea', lat: 40.7465, lng: -74.0014, priceMultiplier: 1.35 },
      { name: 'Greenwich Village', lat: 40.7336, lng: -74.0027, priceMultiplier: 1.4 },
      { name: 'East Village', lat: 40.7265, lng: -73.9815, priceMultiplier: 1.15 },
      { name: 'Midtown', lat: 40.7549, lng: -73.9840, priceMultiplier: 1.5 },
      { name: 'Harlem', lat: 40.8116, lng: -73.9465, priceMultiplier: 0.7 },
      { name: 'Financial District', lat: 40.7075, lng: -74.0089, priceMultiplier: 1.3 },
      { name: 'TriBeCa', lat: 40.7163, lng: -74.0086, priceMultiplier: 1.6 },
      { name: 'SoHo', lat: 40.7233, lng: -73.9985, priceMultiplier: 1.55 },
      // Brooklyn
      { name: 'Williamsburg', lat: 40.7081, lng: -73.9571, priceMultiplier: 1.1 },
      { name: 'Park Slope', lat: 40.6710, lng: -73.9777, priceMultiplier: 1.15 },
      { name: 'DUMBO', lat: 40.7033, lng: -73.9883, priceMultiplier: 1.25 },
      { name: 'Bushwick', lat: 40.6944, lng: -73.9213, priceMultiplier: 0.7 },
      { name: 'Crown Heights', lat: 40.6694, lng: -73.9422, priceMultiplier: 0.75 },
      { name: 'Bed-Stuy', lat: 40.6872, lng: -73.9418, priceMultiplier: 0.7 },
      { name: 'Greenpoint', lat: 40.7282, lng: -73.9512, priceMultiplier: 1.0 },
      // Queens
      { name: 'Astoria', lat: 40.7721, lng: -73.9301, priceMultiplier: 0.8 },
      { name: 'Long Island City', lat: 40.7425, lng: -73.9566, priceMultiplier: 0.95 },
      { name: 'Jackson Heights', lat: 40.7557, lng: -73.8831, priceMultiplier: 0.65 },
    ],
  },

  // ── DC Metro / Northern Virginia ──────────────────────────
  {
    id: 'dc-metro',
    name: 'DC Metro / NoVA',
    state: 'VA',
    basePrice: { 0: 1800, 1: 2300, 2: 3100, 3: 3800, 4: 4500 },
    defaultOffice: { lat: 38.9072, lng: -77.0369, label: 'Downtown DC' },
    zipPrefix: '22',
    streetNames: [
      'Wilson Blvd', 'Clarendon Blvd', 'Washington Blvd', 'Lee Hwy',
      'Columbia Pike', 'King St', 'Mount Vernon Ave', 'Duke St',
      'Broad St', 'Chain Bridge Rd', 'Leesburg Pike', 'Reston Pkwy',
      'Pennsylvania Ave', 'Connecticut Ave', 'Wisconsin Ave', 'M St',
      '14th St', 'U St', 'H St', 'Georgia Ave', '7th St', 'K St',
      'New Hampshire Ave', 'Massachusetts Ave', 'Rhode Island Ave',
    ],
    buildingNames: [
      'The Bartlett', 'Ballston Quarter', 'The Witmer', 'The Palatine',
      'Camden Potomac Yard', 'Parc Meridian', 'The Gramercy', 'Park Crest',
      'West Broad', 'Avant at Reston', 'The Boro', 'Halstead',
      'The Wharf', 'City Ridge', 'The Apollo', 'Novel South Capitol',
      'The Eliot', 'Meridian at Mount Vernon', 'The Continental',
    ],
    neighborhoods: [
      // Arlington
      { name: 'Clarendon', lat: 38.8867, lng: -77.0951, priceMultiplier: 1.15 },
      { name: 'Ballston', lat: 38.8816, lng: -77.1117, priceMultiplier: 1.1 },
      { name: 'Crystal City', lat: 38.8577, lng: -77.0497, priceMultiplier: 1.05 },
      { name: 'Rosslyn', lat: 38.8961, lng: -77.0718, priceMultiplier: 1.15 },
      // Alexandria
      { name: 'Old Town Alexandria', lat: 38.8049, lng: -77.0470, priceMultiplier: 1.1 },
      { name: 'Del Ray', lat: 38.8313, lng: -77.0635, priceMultiplier: 1.0 },
      // Fairfax County
      { name: 'Falls Church', lat: 38.8823, lng: -77.1711, priceMultiplier: 0.9 },
      { name: 'Tysons', lat: 38.9187, lng: -77.2311, priceMultiplier: 1.05 },
      { name: 'Reston', lat: 38.9687, lng: -77.3411, priceMultiplier: 0.85 },
      // DC proper
      { name: 'Dupont Circle', lat: 38.9096, lng: -77.0434, priceMultiplier: 1.3 },
      { name: 'Adams Morgan', lat: 38.9214, lng: -77.0425, priceMultiplier: 1.1 },
      { name: 'Capitol Hill', lat: 38.8869, lng: -76.9956, priceMultiplier: 1.2 },
      { name: 'Georgetown', lat: 38.9076, lng: -77.0723, priceMultiplier: 1.4 },
      { name: 'Navy Yard', lat: 38.8756, lng: -76.9953, priceMultiplier: 1.15 },
      { name: 'Shaw', lat: 38.9119, lng: -77.0217, priceMultiplier: 1.05 },
      { name: 'U Street', lat: 38.9171, lng: -77.0287, priceMultiplier: 1.1 },
      { name: 'Logan Circle', lat: 38.9097, lng: -77.0316, priceMultiplier: 1.2 },
      { name: 'Columbia Heights', lat: 38.9286, lng: -77.0326, priceMultiplier: 0.9 },
    ],
  },

  // ── Chicago ───────────────────────────────────────────────
  // (You mentioned 5 metros — I'll keep it to the 4 you specified + Bay Area.
  //  If a 5th is needed later, this slot is ready.)
];

/** Look up a metro by its id */
export function getMetroById(id: string): Metro | undefined {
  return METROS.find(m => m.id === id);
}

/** Get all metro IDs */
export function getMetroIds(): string[] {
  return METROS.map(m => m.id);
}
