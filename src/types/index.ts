export interface SearchParams {
  metros: string[];
  selectedNeighborhoods?: string[];  // if set, only show these neighborhoods; if undefined, show all
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
}
