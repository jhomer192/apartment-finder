import type { AreaFacts, ScamAssessment, SourceStatus } from '../api/types';

export type { AreaFacts, ScamAssessment, ScamBand, SourceStatus } from '../api/types';

/** Inclusive ranges; `null` on either end of a range means unbounded. */
export interface SearchParams {
  minRent: number;
  maxRent: number;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  /** Applied here rather than at the sources, which do not filter on baths. */
  minBathrooms: number | null;
  maxBathrooms: number | null;
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
  /** Source that supplied baths/sqft when this listing's own site did not. */
  factsFrom: string | null;
  address: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  amenities: string[];
  sourceId: SourceId;
  sourceName: string;
  sourceColor: string;
  url: string;
  imageUrl: string | null;
  imageUrls: string[];
  scam: ScamAssessment;
  /** Public civic data about the block: rail, reported incidents, metered parking. */
  area: AreaFacts | null;
  metroId: string;
  gradientFrom: string;
  gradientTo: string;
}

export type SortOption =
  | 'price-asc'
  | 'price-desc'
  | 'scam-desc'
  | 'sqft-desc'
  | 'ppsqft'
  | 'scam'
  | 'transit'
  | 'incidents';

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
