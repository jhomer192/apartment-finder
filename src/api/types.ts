export type ScamBand = 'low' | 'medium' | 'high';

export interface ScamAssessment {
  score: number;
  band: ScamBand;
  reasons: string[];
}

export interface ApiListing {
  key: string;
  sourceId: string;
  sourceName: string;
  externalId: string;
  title: string;
  description: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  url: string;
  imageUrl: string | null;
  photoCount: number;
  postedAt: number | null;
  neighborhood: string;
  scam: ScamAssessment;
}

export interface SourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  count: number;
  error: string | null;
}

export interface ListingsResponse {
  listings: ApiListing[];
  sources: SourceStatus[];
  fetchedAt: number;
}

export interface SessionUser {
  email: string;
  isAdmin: boolean;
}
