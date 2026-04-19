export interface SearchParams {
  metros: string[];
  minRent: number;
  maxRent: number;
  bedrooms: number | null;
  officeAddress: string;
}

export interface SearchSource {
  id: string;
  name: string;
  color: string;
  description: string;
  buildUrl: (params: SourceUrlParams) => string;
}

export interface SourceUrlParams {
  city: string;
  state: string;
  citySlug: string;
  region: string;
  minRent: number;
  maxRent: number;
  bedrooms: number | null;
}

export interface NeighborhoodCommute {
  name: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  estimatedMinutes: number;
  commuteColor: 'green' | 'yellow' | 'orange' | 'red';
}

export type SourceId = 'zillow' | 'apartments' | 'craigslist' | 'trulia' | 'redfin' | 'facebook' | 'hotpads' | 'rent' | 'padmapper';

export interface Listing {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  address: string;
  neighborhood: string;
  amenities: string[];
  sourceId: SourceId;
  sourceName: string;
  sourceColor: string;
  url: string;
  commuteMinutes: number;
  commuteColor: 'green' | 'yellow' | 'orange' | 'red';
  metroId: string;
  gradientFrom: string;
  gradientTo: string;
}

export type SortOption = 'price-asc' | 'price-desc' | 'commute' | 'sqft-desc' | 'ppsqft';

export interface SearchResult {
  metroId: string;
  metroName: string;
  state: string;
  city: string;
  citySlug: string;
  region: string;
  centerLat: number;
  centerLng: number;
  sources: Array<{
    source: SearchSource;
    url: string;
  }>;
  neighborhoods: NeighborhoodCommute[];
  listings: Listing[];
}
