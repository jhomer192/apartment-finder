export interface SearchParams {
  city: string;
  minRent: number;
  maxRent: number;
  bedrooms: number | null;
  officeAddress: string;
}

export interface Listing {
  id: string;
  source: string;
  title: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  photoUrl: string | null;
  amenities: string[];
  description: string;
  url: string;
  datePosted: string;
}

export interface MergedListing extends Listing {
  sources: string[];
  sourceCount: number;
}

export interface CommuteInfo {
  distanceMiles: number;
  estimatedMinutes: number;
  method: 'google_maps' | 'haversine';
}

export interface ScoredListing extends MergedListing {
  commute: CommuteInfo;
  pricePerSqft: number;
  commuteColor: 'green' | 'yellow' | 'orange' | 'red';
  isFavorite: boolean;
}

export type SortField = 'price' | 'commute' | 'sqft' | 'pricePerSqft';
export type SortDirection = 'asc' | 'desc';

export interface FilterState {
  amenities: Set<string>;
}

export interface ApartmentSource {
  name: string;
  search(params: SearchParams): Promise<Listing[]>;
}
