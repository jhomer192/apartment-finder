import type { ScamAssessment, SourceStatus } from '../api/types';

export type { ScamAssessment, ScamBand, SourceStatus } from '../api/types';

export interface SearchParams {
  metros: string[];
  minRent: number;
  maxRent: number;
  bedrooms: number | null;
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

export interface NeighborhoodPin {
  name: string;
  lat: number;
  lng: number;
}

export type SourceId = 'zillow' | 'apartments' | 'craigslist' | 'trulia' | 'redfin' | 'facebook' | 'hotpads' | 'rent' | 'padmapper';

export interface Listing {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  bathrooms: number | null;
  sqft: number | null;
  address: string;
  neighborhood: string;
  amenities: string[];
  sourceId: SourceId;
  sourceName: string;
  sourceColor: string;
  url: string;
  imageUrl: string | null;
  scam: ScamAssessment;
  metroId: string;
  gradientFrom: string;
  gradientTo: string;
}

export type SortOption = 'price-asc' | 'price-desc' | 'scam-desc' | 'sqft-desc' | 'ppsqft' | 'scam';

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
  neighborhoods: NeighborhoodPin[];
  listings: Listing[];
  sourceStatuses: SourceStatus[];
}
