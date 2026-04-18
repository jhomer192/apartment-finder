export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
  priceMultiplier: number;
}

export interface Metro {
  id: string;
  name: string;
  city: string;
  citySlug: string;
  state: string;
  region: string; // craigslist region
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
    city: 'San Francisco',
    citySlug: 'san-francisco',
    state: 'CA',
    region: 'sfbay',
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
    city: 'Los Angeles',
    citySlug: 'los-angeles',
    state: 'CA',
    region: 'losangeles',
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
    city: 'New York',
    citySlug: 'new-york',
    state: 'NY',
    region: 'newyork',
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
    city: 'Washington',
    citySlug: 'washington',
    state: 'DC',
    region: 'washingtondc',
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

  // ── Boston ────────────────────────────────────────────────
  {
    id: 'boston',
    name: 'Boston',
    city: 'Boston',
    citySlug: 'boston',
    state: 'MA',
    region: 'boston',
    basePrice: { 0: 2000, 1: 2600, 2: 3400, 3: 4200, 4: 5000 },
    defaultOffice: { lat: 42.3601, lng: -71.0589, label: 'Downtown Boston' },
    zipPrefix: '02',
    streetNames: [
      'Boylston St', 'Newbury St', 'Commonwealth Ave', 'Beacon St', 'Tremont St',
      'Washington St', 'Atlantic Ave', 'Congress St', 'Summer St', 'Milk St',
      'State St', 'Federal St', 'Franklin St', 'High St', 'Broad St',
      'Cambridge St', 'Charles St', 'Mount Vernon St', 'Joy St', 'Hanover St',
    ],
    buildingNames: [
      'The Kensington', 'One Dalton', 'Avalon North Station', 'The Eddy', 'Waterside Place',
      'Hub50 House', 'The Benjamin', 'VIA', 'Sepia', 'One Canal',
    ],
    neighborhoods: [
      { name: 'Back Bay', lat: 42.3503, lng: -71.0810, priceMultiplier: 1.5 },
      { name: 'Beacon Hill', lat: 42.3588, lng: -71.0707, priceMultiplier: 1.45 },
      { name: 'South End', lat: 42.3424, lng: -71.0740, priceMultiplier: 1.3 },
      { name: 'Seaport', lat: 42.3480, lng: -71.0440, priceMultiplier: 1.4 },
      { name: 'North End', lat: 42.3647, lng: -71.0542, priceMultiplier: 1.25 },
      { name: 'Financial District', lat: 42.3559, lng: -71.0550, priceMultiplier: 1.35 },
      { name: 'Fenway-Kenmore', lat: 42.3467, lng: -71.0972, priceMultiplier: 1.15 },
      { name: 'Jamaica Plain', lat: 42.3097, lng: -71.1151, priceMultiplier: 0.85 },
      { name: 'Allston', lat: 42.3539, lng: -71.1337, priceMultiplier: 0.75 },
      { name: 'Brighton', lat: 42.3509, lng: -71.1564, priceMultiplier: 0.7 },
      { name: 'Somerville', lat: 42.3876, lng: -71.0995, priceMultiplier: 0.9 },
      { name: 'Cambridge', lat: 42.3736, lng: -71.1097, priceMultiplier: 1.2 },
      { name: 'Charlestown', lat: 42.3782, lng: -71.0602, priceMultiplier: 1.1 },
      { name: 'Dorchester', lat: 42.3016, lng: -71.0674, priceMultiplier: 0.65 },
      { name: 'Brookline', lat: 42.3318, lng: -71.1212, priceMultiplier: 1.1 },
    ],
  },

  // ── Chicago ──────────────────────────────────────────────
  {
    id: 'chicago',
    name: 'Chicago',
    city: 'Chicago',
    citySlug: 'chicago',
    state: 'IL',
    region: 'chicago',
    basePrice: { 0: 1400, 1: 1800, 2: 2400, 3: 3000, 4: 3600 },
    defaultOffice: { lat: 41.8781, lng: -87.6298, label: 'The Loop' },
    zipPrefix: '60',
    streetNames: [
      'Michigan Ave', 'State St', 'Clark St', 'LaSalle St', 'Dearborn St',
      'Halsted St', 'Ashland Ave', 'Western Ave', 'Milwaukee Ave', 'Division St',
      'North Ave', 'Armitage Ave', 'Fullerton Ave', 'Belmont Ave', 'Irving Park Rd',
    ],
    buildingNames: [
      'The Legacy', 'NEMA Chicago', 'One Bennett Park', 'Optima Signature',
      'The Paragon', '1000M', 'Cascade', 'Arkadia Tower', 'The Cooper', 'Lakeshore East',
    ],
    neighborhoods: [
      { name: 'The Loop', lat: 41.8819, lng: -87.6278, priceMultiplier: 1.4 },
      { name: 'River North', lat: 41.8922, lng: -87.6355, priceMultiplier: 1.5 },
      { name: 'Gold Coast', lat: 41.9039, lng: -87.6287, priceMultiplier: 1.45 },
      { name: 'Lincoln Park', lat: 41.9214, lng: -87.6513, priceMultiplier: 1.35 },
      { name: 'Lakeview', lat: 41.9434, lng: -87.6553, priceMultiplier: 1.2 },
      { name: 'Wicker Park', lat: 41.9088, lng: -87.6796, priceMultiplier: 1.15 },
      { name: 'Logan Square', lat: 41.9234, lng: -87.7082, priceMultiplier: 1.0 },
      { name: 'West Loop', lat: 41.8855, lng: -87.6517, priceMultiplier: 1.3 },
      { name: 'South Loop', lat: 41.8569, lng: -87.6247, priceMultiplier: 1.15 },
      { name: 'Pilsen', lat: 41.8525, lng: -87.6564, priceMultiplier: 0.85 },
      { name: 'Hyde Park', lat: 41.7943, lng: -87.5907, priceMultiplier: 0.9 },
      { name: 'Uptown', lat: 41.9658, lng: -87.6536, priceMultiplier: 0.8 },
      { name: 'Edgewater', lat: 41.9833, lng: -87.6609, priceMultiplier: 0.75 },
      { name: 'Ravenswood', lat: 41.9741, lng: -87.6739, priceMultiplier: 0.95 },
    ],
  },

  // ── Seattle ──────────────────────────────────────────────
  {
    id: 'seattle',
    name: 'Seattle',
    city: 'Seattle',
    citySlug: 'seattle',
    state: 'WA',
    region: 'seattle',
    basePrice: { 0: 1700, 1: 2200, 2: 2900, 3: 3600, 4: 4200 },
    defaultOffice: { lat: 47.6062, lng: -122.3321, label: 'Downtown Seattle' },
    zipPrefix: '98',
    streetNames: [
      'Pike St', 'Pine St', '1st Ave', '2nd Ave', '3rd Ave',
      'University St', 'Spring St', 'Madison St', 'Marion St', 'Columbia St',
      'Cherry St', 'James St', 'Yesler Way', 'Jackson St', 'King St',
    ],
    buildingNames: [
      'Kinects', 'AMLI Arc', 'Rivet', 'The Martin', 'Cirrus',
      'Via6', 'Insignia', 'Luma', 'Gridiron', 'The Danforth',
    ],
    neighborhoods: [
      { name: 'Capitol Hill', lat: 47.6253, lng: -122.3222, priceMultiplier: 1.2 },
      { name: 'Belltown', lat: 47.6146, lng: -122.3479, priceMultiplier: 1.3 },
      { name: 'South Lake Union', lat: 47.6264, lng: -122.3383, priceMultiplier: 1.4 },
      { name: 'Fremont', lat: 47.6513, lng: -122.3500, priceMultiplier: 1.1 },
      { name: 'Ballard', lat: 47.6680, lng: -122.3847, priceMultiplier: 1.05 },
      { name: 'Queen Anne', lat: 47.6373, lng: -122.3571, priceMultiplier: 1.15 },
      { name: 'University District', lat: 47.6617, lng: -122.3133, priceMultiplier: 0.8 },
      { name: 'Wallingford', lat: 47.6579, lng: -122.3353, priceMultiplier: 1.0 },
      { name: 'Columbia City', lat: 47.5600, lng: -122.2868, priceMultiplier: 0.85 },
      { name: 'Beacon Hill', lat: 47.5683, lng: -122.3114, priceMultiplier: 0.75 },
      { name: 'West Seattle', lat: 47.5607, lng: -122.3871, priceMultiplier: 0.9 },
      { name: 'Redmond', lat: 47.6740, lng: -122.1215, priceMultiplier: 1.1 },
      { name: 'Bellevue', lat: 47.6101, lng: -122.2015, priceMultiplier: 1.25 },
    ],
  },

  // ── Austin ───────────────────────────────────────────────
  {
    id: 'austin',
    name: 'Austin',
    city: 'Austin',
    citySlug: 'austin',
    state: 'TX',
    region: 'austin',
    basePrice: { 0: 1200, 1: 1500, 2: 2000, 3: 2500, 4: 3000 },
    defaultOffice: { lat: 30.2672, lng: -97.7431, label: 'Downtown Austin' },
    zipPrefix: '78',
    streetNames: [
      'Congress Ave', '6th St', 'Lamar Blvd', 'Guadalupe St', 'Red River St',
      'Rainey St', 'Cesar Chavez St', 'Barton Springs Rd', 'South 1st St', 'Manor Rd',
      'Airport Blvd', 'Burnet Rd', 'Anderson Ln', 'Oltorf St', 'Riverside Dr',
    ],
    buildingNames: [
      'The Independent', 'Northshore', 'Rainey House', '44 East', 'The Bowie',
      'Moontower', 'Hanover Republic Square', 'Camden Rainey Street', 'Amli on 2nd', 'The Kazmir',
    ],
    neighborhoods: [
      { name: 'Downtown', lat: 30.2672, lng: -97.7431, priceMultiplier: 1.4 },
      { name: 'East Austin', lat: 30.2620, lng: -97.7220, priceMultiplier: 1.1 },
      { name: 'South Congress', lat: 30.2491, lng: -97.7484, priceMultiplier: 1.25 },
      { name: 'Zilker', lat: 30.2650, lng: -97.7729, priceMultiplier: 1.3 },
      { name: 'Clarksville', lat: 30.2808, lng: -97.7596, priceMultiplier: 1.2 },
      { name: 'Hyde Park', lat: 30.3030, lng: -97.7285, priceMultiplier: 1.0 },
      { name: 'Mueller', lat: 30.2990, lng: -97.7050, priceMultiplier: 1.05 },
      { name: 'North Loop', lat: 30.3162, lng: -97.7223, priceMultiplier: 0.9 },
      { name: 'Riverside', lat: 30.2390, lng: -97.7280, priceMultiplier: 0.75 },
      { name: 'Domain', lat: 30.4015, lng: -97.7248, priceMultiplier: 1.1 },
      { name: 'Round Rock', lat: 30.5083, lng: -97.6789, priceMultiplier: 0.65 },
      { name: 'Cedar Park', lat: 30.5052, lng: -97.8203, priceMultiplier: 0.6 },
    ],
  },

  // ── Denver ───────────────────────────────────────────────
  {
    id: 'denver',
    name: 'Denver',
    city: 'Denver',
    citySlug: 'denver',
    state: 'CO',
    region: 'denver',
    basePrice: { 0: 1400, 1: 1700, 2: 2200, 3: 2800, 4: 3400 },
    defaultOffice: { lat: 39.7392, lng: -104.9903, label: 'Downtown Denver' },
    zipPrefix: '80',
    streetNames: [
      '16th St', 'Colfax Ave', 'Broadway', 'Larimer St', 'Blake St',
      'Wynkoop St', 'Wazee St', 'Market St', 'Champa St', 'Stout St',
      'California St', 'Welton St', 'Downing St', 'York St', 'Colorado Blvd',
    ],
    buildingNames: [
      'The Coloradan', 'Verve', '1000 Speer', 'The Confluence', 'Revere',
      'Alto', 'Modera LoHi', 'The Alcott', 'Broadstone Infinity', 'Zia Sunnyside',
    ],
    neighborhoods: [
      { name: 'LoDo', lat: 39.7536, lng: -104.9997, priceMultiplier: 1.4 },
      { name: 'RiNo', lat: 39.7660, lng: -104.9788, priceMultiplier: 1.3 },
      { name: 'Capitol Hill', lat: 39.7312, lng: -104.9780, priceMultiplier: 1.1 },
      { name: 'Highland', lat: 39.7611, lng: -105.0100, priceMultiplier: 1.25 },
      { name: 'LoHi', lat: 39.7588, lng: -105.0082, priceMultiplier: 1.35 },
      { name: 'Wash Park', lat: 39.6977, lng: -104.9745, priceMultiplier: 1.2 },
      { name: 'Cherry Creek', lat: 39.7174, lng: -104.9555, priceMultiplier: 1.4 },
      { name: 'Baker', lat: 39.7154, lng: -104.9924, priceMultiplier: 1.0 },
      { name: 'City Park', lat: 39.7475, lng: -104.9565, priceMultiplier: 1.05 },
      { name: 'Sloan Lake', lat: 39.7504, lng: -105.0330, priceMultiplier: 1.1 },
      { name: 'Five Points', lat: 39.7547, lng: -104.9738, priceMultiplier: 0.95 },
      { name: 'Stapleton/Central Park', lat: 39.7660, lng: -104.8886, priceMultiplier: 0.85 },
      { name: 'Aurora', lat: 39.7294, lng: -104.8319, priceMultiplier: 0.65 },
    ],
  },

  // ── Miami ────────────────────────────────────────────────
  {
    id: 'miami',
    name: 'Miami',
    city: 'Miami',
    citySlug: 'miami',
    state: 'FL',
    region: 'miami',
    basePrice: { 0: 1600, 1: 2100, 2: 2800, 3: 3500, 4: 4200 },
    defaultOffice: { lat: 25.7617, lng: -80.1918, label: 'Downtown Miami' },
    zipPrefix: '33',
    streetNames: [
      'Brickell Ave', 'Collins Ave', 'Ocean Dr', 'Washington Ave', 'Lincoln Rd',
      'Flagler St', 'Biscayne Blvd', 'Coral Way', 'Calle Ocho', 'Bird Rd',
      'Miracle Mile', 'Giralda Ave', 'Ponce de Leon Blvd', 'Main Hwy', 'Grand Ave',
    ],
    buildingNames: [
      'Brickell Heights', 'SLS Lux', 'Paraiso', 'Icon Brickell', 'Edgewater Midtown',
      'The Elser', 'Natiivo', 'Aria on the Bay', 'Canvas', 'Biscayne Beach',
    ],
    neighborhoods: [
      { name: 'Brickell', lat: 25.7582, lng: -80.1929, priceMultiplier: 1.45 },
      { name: 'Downtown Miami', lat: 25.7751, lng: -80.1947, priceMultiplier: 1.3 },
      { name: 'Wynwood', lat: 25.8004, lng: -80.1990, priceMultiplier: 1.2 },
      { name: 'Edgewater', lat: 25.7925, lng: -80.1862, priceMultiplier: 1.25 },
      { name: 'South Beach', lat: 25.7826, lng: -80.1341, priceMultiplier: 1.5 },
      { name: 'Mid-Beach', lat: 25.8079, lng: -80.1319, priceMultiplier: 1.35 },
      { name: 'Coconut Grove', lat: 25.7275, lng: -80.2421, priceMultiplier: 1.3 },
      { name: 'Coral Gables', lat: 25.7215, lng: -80.2684, priceMultiplier: 1.25 },
      { name: 'Little Havana', lat: 25.7658, lng: -80.2190, priceMultiplier: 0.7 },
      { name: 'Design District', lat: 25.8120, lng: -80.1928, priceMultiplier: 1.15 },
      { name: 'Midtown', lat: 25.8063, lng: -80.1928, priceMultiplier: 1.2 },
      { name: 'North Miami', lat: 25.8900, lng: -80.1867, priceMultiplier: 0.75 },
      { name: 'Doral', lat: 25.8195, lng: -80.3553, priceMultiplier: 0.8 },
      { name: 'Aventura', lat: 25.9565, lng: -80.1392, priceMultiplier: 1.1 },
    ],
  },
];

/** Look up a metro by its id */
export function getMetroById(id: string): Metro | undefined {
  return METROS.find(m => m.id === id);
}

/** Get all metro IDs */
export function getMetroIds(): string[] {
  return METROS.map(m => m.id);
}
