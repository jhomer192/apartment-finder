export type ScamBand = 'low' | 'medium' | 'high';

export interface ScamAssessment {
  score: number;
  band: ScamBand;
  reasons: string[];
  checks: string[];
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
  /** Absent on shortlist entries saved before galleries existed. */
  imageUrls?: string[];
  photoCount: number;
  postedAt: number | null;
  contactPhone: string | null;
  contactEmail: string | null;
  detail: 'full' | 'summary';
  /** Set when the baths/sqft shown came from another site's listing for the same building. */
  factsFrom?: string;
  neighborhood: string;
  scam: ScamAssessment;
  /** Public civic data about the block; absent on listings saved before it existed. */
  area?: AreaFacts | null;
}

export interface AreaFacts {
  /** `walkMinutes` is null when the stop is too far for a straight line to mean anything. */
  transit: { name: string; kind: string; meters: number; walkMinutes: number | null } | null;
  /** Rates are per 100k residents in the radius, so density is not read as danger. */
  incidents: {
    count: number;
    residents: number;
    ratePer100k: number;
    cityRatePer100k: number;
    radiusMeters: number;
  } | null;
  /** A ranking of violent-crime rates against the rest of the city, not a promise of safety. */
  safety?: {
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    violentCount: number;
    residents: number;
    ratePer100k: number;
    cityRatePer100k: number;
    radiusMeters: number;
    quieterThanPercent: number;
  } | null;
  parking: { meteredSpaces: number; radiusMeters: number } | null;
}

export interface SourceStatus {
  id: string;
  name: string;
  enabled: boolean;
  count: number;
  error: string | null;
}

/** State of the nightly crawl that fills the searchable set. */
export interface InventoryStatus {
  listings: number;
  refreshedAt: number | null;
  refreshing: boolean;
  sources: SourceStatus[];
  error: string | null;
}

export interface ListingsResponse {
  listings: ApiListing[];
  sources: SourceStatus[];
  fetchedAt: number;
}

export interface AlertPrefs {
  enabled: boolean;
  minRent: number;
  maxRent: number;
  minBedrooms: number;
  neighborhoods: string[];
  maxScamScore: number;
  viaEmail: boolean;
  viaDiscord: boolean;
}

export interface AlertSettings {
  prefs: AlertPrefs;
  channels: { email: boolean; discord: boolean };
}

export interface SearchPlan {
  minRent: number;
  maxRent: number;
  maxRentPerBedroom: number;
  bedrooms: number[];
  minBathrooms: number;
  bathsPerBedroom: number;
  neighborhoods: string[];
  maxScamScore: number;
  keywords: string[];
  sort: 'value' | 'price-asc' | 'price-desc' | 'per-bedroom-asc' | 'safest';
}

export interface RankedListing {
  listing: ApiListing;
  verdict: 'great deal' | 'fair' | 'overpriced' | 'scam risk';
  why: string;
  valueDelta: number;
}

export interface ClaudeSearchResult {
  answer: string;
  plan: SearchPlan;
  matched: number;
  ranked: RankedListing[];
  relaxed: string[];
}

export const SAVED_STATUSES = ['saved', 'contacted', 'touring', 'applied', 'passed'] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];

export interface ListingNote {
  id: number;
  email: string;
  body: string;
  createdAt: number;
}

export interface SavedListing {
  key: string;
  listing: ApiListing;
  savedBy: string;
  savedAt: number;
  status: SavedStatus;
  statusAt: number;
  notes: ListingNote[];
}

export interface ContactDraft {
  subject: string;
  body: string;
  email: string | null;
  phone: string | null;
  url: string;
}

export interface SessionUser {
  email: string;
  isAdmin: boolean;
  hasPassword?: boolean;
}
