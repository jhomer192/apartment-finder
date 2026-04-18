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
  'downtown san francisco': { lat: 37.7749, lng: -122.4194 },
  'financial district sf': { lat: 37.7946, lng: -122.3999 },
  'soma sf': { lat: 37.7785, lng: -122.3950 },
  'market street sf': { lat: 37.7749, lng: -122.4194 },
  'embarcadero sf': { lat: 37.7955, lng: -122.3937 },
  'salesforce tower': { lat: 37.7897, lng: -122.3972 },
  'twitter hq': { lat: 37.7764, lng: -122.4165 },
  'union square sf': { lat: 37.7879, lng: -122.4074 },
};

export function geocodeOfficeAddress(address: string): { lat: number; lng: number } | null {
  const lower = address.toLowerCase().trim();

  // Check known locations
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return coords;
    }
  }

  // Default to downtown SF for demo purposes
  if (lower.includes('sf') || lower.includes('san francisco') || lower.length > 0) {
    return { lat: 37.7749, lng: -122.4194 };
  }

  return null;
}
