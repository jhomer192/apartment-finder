import { useState, useCallback, useRef } from 'react';
import type { SearchParams, SearchResult, NeighborhoodPin, Listing, SourceId } from '../types';
import type { ApiListing } from '../api/types';
import { fetchListings } from '../api/client';
import { SEARCH_SOURCES } from '../data/sources';
import { getMetroById } from '../data/metros';
import { bathroomsInRange } from '../utils/rooms';

const SOURCE_COLORS: Record<string, string> = {
  redfin: '#c82021',
  craigslist: '#6d28d9',
};

/** The server only fetches San Francisco, so offering other metros would lie. */
const SEARCHED_METRO = 'bay-area';

const GRADIENTS: Array<[string, string]> = [
  ['#0ea5e9', '#6366f1'],
  ['#f97316', '#ec4899'],
  ['#14b8a6', '#22c55e'],
  ['#8b5cf6', '#d946ef'],
];

function relativeDays(postedAt: number | null): string | null {
  if (postedAt === null) return null;
  const days = Math.floor((Date.now() - postedAt) / 86_400_000);
  if (days <= 0) return 'Posted today';
  return `Posted ${days}d ago`;
}

function toListing(listing: ApiListing, metroId: string, index: number): Listing {
  const [gradientFrom, gradientTo] = GRADIENTS[index % GRADIENTS.length];

  const amenities = [
    listing.photoCount > 0 ? `${listing.photoCount} photos` : 'No photos',
    relativeDays(listing.postedAt),
    listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
  ].filter((value): value is string => value !== null);

  return {
    id: listing.key,
    title: listing.title,
    price: listing.price,
    bedrooms: listing.bedrooms ?? 0,
    bathrooms: listing.bathrooms,
    sqft: listing.sqft,
    factsFrom: listing.factsFrom ?? null,
    address: listing.address,
    neighborhood: listing.neighborhood,
    lat: listing.lat,
    lng: listing.lng,
    amenities,
    sourceId: listing.sourceId as SourceId,
    sourceName: listing.sourceName,
    sourceColor: SOURCE_COLORS[listing.sourceId] ?? '#64748b',
    url: listing.url,
    imageUrl: listing.imageUrl,
    imageUrls: listing.imageUrls ?? [],
    scam: listing.scam,
    metroId,
    gradientFrom,
    gradientTo,
  };
}

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const search = useCallback(async (params: SearchParams) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const metro = getMetroById(SEARCHED_METRO);
      if (!metro) throw new Error('Unknown metro');

      const neighborhoods: NeighborhoodPin[] = metro.neighborhoods.map((hood) => ({
        name: hood.name,
        lat: hood.lat,
        lng: hood.lng,
      }));

      const response = await fetchListings(
        {
          minRent: params.minRent,
          maxRent: params.maxRent,
          minBedrooms: params.minBedrooms,
          maxBedrooms: params.maxBedrooms,
        },
        controller.signal,
      );

      const urlParams = {
        city: metro.city,
        state: metro.state,
        citySlug: metro.citySlug,
        region: metro.region,
        minRent: params.minRent,
        maxRent: params.maxRent,
        // The other sites take one bed count, so their links use the low end.
        bedrooms: params.minBedrooms,
      };

      const centerLat = metro.neighborhoods.reduce((s, n) => s + n.lat, 0) / metro.neighborhoods.length;
      const centerLng = metro.neighborhoods.reduce((s, n) => s + n.lng, 0) / metro.neighborhoods.length;

      setResults([
        {
          metroId: metro.id,
          metroName: metro.name,
          state: metro.state,
          city: metro.city,
          citySlug: metro.citySlug,
          region: metro.region,
          centerLat,
          centerLng,
          sources: SEARCH_SOURCES.map((source) => ({ source, url: source.buildUrl(urlParams) })),
          neighborhoods,
          listings: response.listings
            .map((listing, index) => toListing(listing, metro.id, index))
            .filter((listing) => bathroomsInRange(listing.bathrooms, params)),
          sourceStatuses: response.sources,
        },
      ]);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  return {
    results,
    loading,
    error,
    hasSearched,
    search,
  };
}
