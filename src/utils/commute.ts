import type { CommuteInfo } from '../types';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

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

function estimateCommuteMinutes(distanceMiles: number): number {
  // Rough city driving estimate: ~12 mph average with traffic, stops, etc.
  // Plus 5 min for parking/walking
  return Math.round(distanceMiles / 12 * 60 + 5);
}

export function getCommuteColor(minutes: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (minutes < 15) return 'green';
  if (minutes < 30) return 'yellow';
  if (minutes < 45) return 'orange';
  return 'red';
}

export async function calculateCommute(
  listingLat: number,
  listingLng: number,
  officeLat: number,
  officeLng: number,
): Promise<CommuteInfo> {
  const distance = haversineDistance(listingLat, listingLng, officeLat, officeLng);

  // If Google Maps API key is available, attempt to use Distance Matrix
  if (GOOGLE_MAPS_API_KEY && window.google?.maps) {
    try {
      return await googleMapsCommute(listingLat, listingLng, officeLat, officeLng);
    } catch {
      // Fall through to haversine
    }
  }

  return {
    distanceMiles: Math.round(distance * 10) / 10,
    estimatedMinutes: estimateCommuteMinutes(distance),
    method: 'haversine',
  };
}

function googleMapsCommute(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): Promise<CommuteInfo> {
  return new Promise((resolve, reject) => {
    const service = new window.google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [new window.google.maps.LatLng(lat1, lng1)],
        destinations: [new window.google.maps.LatLng(lat2, lng2)],
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status !== 'OK' || !response) {
          reject(new Error(`Google Maps error: ${status}`));
          return;
        }
        const element = response.rows[0]?.elements[0];
        if (!element || element.status !== 'OK') {
          reject(new Error('No route found'));
          return;
        }
        resolve({
          distanceMiles: Math.round((element.distance.value / 1609.34) * 10) / 10,
          estimatedMinutes: Math.round(element.duration.value / 60),
          method: 'google_maps',
        });
      },
    );
  });
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

  // Last resort — return something if there's any text
  if (lower.length > 0) {
    return { lat: 37.7749, lng: -122.4194 };
  }

  return null;
}
