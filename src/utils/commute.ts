function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getCommuteColor(minutes: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (minutes < 15) return 'green';
  if (minutes < 30) return 'yellow';
  if (minutes < 45) return 'orange';
  return 'red';
}

// Simple geocoding fallback: hardcoded well-known locations
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Bay Area
  'downtown san francisco': { lat: 37.7749, lng: -122.4194 },
  'financial district sf': { lat: 37.7946, lng: -122.3999 },
  'soma sf': { lat: 37.7785, lng: -122.3950 },
  'market street sf': { lat: 37.7749, lng: -122.4194 },
  'embarcadero sf': { lat: 37.7955, lng: -122.3937 },
  'salesforce tower': { lat: 37.7897, lng: -122.3972 },
  'twitter hq': { lat: 37.7764, lng: -122.4165 },
  'union square sf': { lat: 37.7879, lng: -122.4074 },
  'google hq': { lat: 37.4220, lng: -122.0841 },
  'apple park': { lat: 37.3349, lng: -122.0090 },
  // NYC
  'times square': { lat: 40.7580, lng: -73.9855 },
  'wall street': { lat: 40.7068, lng: -74.0089 },
  'grand central': { lat: 40.7527, lng: -73.9772 },
  'penn station': { lat: 40.7506, lng: -73.9935 },
  'hudson yards': { lat: 40.7536, lng: -74.0009 },
  // LA
  'downtown la': { lat: 34.0407, lng: -118.2468 },
  'downtown los angeles': { lat: 34.0407, lng: -118.2468 },
  'lax': { lat: 33.9425, lng: -118.4081 },
  'century city': { lat: 34.0567, lng: -118.4177 },
  // DC
  'downtown dc': { lat: 38.9072, lng: -77.0369 },
  'the pentagon': { lat: 38.8719, lng: -77.0563 },
  'capitol hill': { lat: 38.8899, lng: -77.0091 },
  'white house': { lat: 38.8977, lng: -77.0365 },
  'tysons corner': { lat: 38.9187, lng: -77.2311 },
  // Boston
  'downtown boston': { lat: 42.3601, lng: -71.0589 },
  'boston common': { lat: 42.3554, lng: -71.0656 },
  'harvard square': { lat: 42.3732, lng: -71.1189 },
  'mit': { lat: 42.3601, lng: -71.0942 },
  'kendall square': { lat: 42.3629, lng: -71.0862 },
  'faneuil hall': { lat: 42.3600, lng: -71.0569 },
  // Chicago
  'downtown chicago': { lat: 41.8781, lng: -87.6298 },
  'the loop chicago': { lat: 41.8819, lng: -87.6278 },
  'willis tower': { lat: 41.8789, lng: -87.6359 },
  'navy pier': { lat: 41.8917, lng: -87.6086 },
  'wrigley field': { lat: 41.9484, lng: -87.6553 },
  // Seattle
  'downtown seattle': { lat: 47.6062, lng: -122.3321 },
  'amazon hq': { lat: 47.6222, lng: -122.3363 },
  'pike place': { lat: 47.6097, lng: -122.3422 },
  'microsoft redmond': { lat: 47.6440, lng: -122.1302 },
  'space needle': { lat: 47.6205, lng: -122.3493 },
  // Austin
  'downtown austin': { lat: 30.2672, lng: -97.7431 },
  'ut austin': { lat: 30.2849, lng: -97.7341 },
  'the domain austin': { lat: 30.4015, lng: -97.7248 },
  'tesla giga texas': { lat: 30.2218, lng: -97.6166 },
  // Denver
  'downtown denver': { lat: 39.7392, lng: -104.9903 },
  'union station denver': { lat: 39.7531, lng: -105.0002 },
  'coors field': { lat: 39.7559, lng: -104.9942 },
  'denver tech center': { lat: 39.6478, lng: -104.8972 },
  // Miami
  'downtown miami': { lat: 25.7751, lng: -80.1947 },
  'brickell': { lat: 25.7582, lng: -80.1929 },
  'south beach': { lat: 25.7826, lng: -80.1341 },
  'wynwood': { lat: 25.8004, lng: -80.1990 },
  'miami airport': { lat: 25.7959, lng: -80.2870 },
};

export function geocodeOfficeAddress(address: string): { lat: number; lng: number } | null {
  const lower = address.toLowerCase().trim();

  // Check known locations
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return coords;
    }
  }

  // Fall back to approximate center based on keywords
  if (lower.includes('sf') || lower.includes('san francisco')) {
    return { lat: 37.7749, lng: -122.4194 };
  }
  if (lower.includes('new york') || lower.includes('nyc') || lower.includes('manhattan')) {
    return { lat: 40.7580, lng: -73.9855 };
  }
  if (lower.includes('los angeles') || lower.includes('la')) {
    return { lat: 34.0522, lng: -118.2437 };
  }
  if (lower.includes('dc') || lower.includes('washington') || lower.includes('arlington') || lower.includes('virginia')) {
    return { lat: 38.9072, lng: -77.0369 };
  }
  if (lower.includes('boston') || lower.includes('cambridge') || lower.includes('somerville')) {
    return { lat: 42.3601, lng: -71.0589 };
  }
  if (lower.includes('chicago')) {
    return { lat: 41.8781, lng: -87.6298 };
  }
  if (lower.includes('seattle') || lower.includes('bellevue') || lower.includes('redmond')) {
    return { lat: 47.6062, lng: -122.3321 };
  }
  if (lower.includes('austin') || lower.includes('round rock')) {
    return { lat: 30.2672, lng: -97.7431 };
  }
  if (lower.includes('denver') || lower.includes('aurora') || lower.includes('boulder')) {
    return { lat: 39.7392, lng: -104.9903 };
  }
  if (lower.includes('miami') || lower.includes('brickell') || lower.includes('coral gables') || lower.includes('fort lauderdale')) {
    return { lat: 25.7617, lng: -80.1918 };
  }

  // Last resort -- return something if there's any text
  if (lower.length > 0) {
    return { lat: 37.7749, lng: -122.4194 };
  }

  return null;
}
