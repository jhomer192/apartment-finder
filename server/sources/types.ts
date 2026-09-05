export interface RawListing {
  /** Stable per-source id, used to build the cross-source `listing_key`. */
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
  contactEmail: string | null;
  contactPhone: string | null;
  /**
   * `summary` means the source withheld fields like photos or the address, so
   * their absence says nothing about the listing itself.
   */
  detail: 'full' | 'summary';
}

export interface SourceQuery {
  minRent: number;
  maxRent: number;
  bedrooms: number | null;
  limit: number;
}

export interface ListingSource {
  id: string;
  name: string;
  enabled: boolean;
  fetchListings(query: SourceQuery): Promise<RawListing[]>;
}

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function fetchWithTimeout(url: string, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
