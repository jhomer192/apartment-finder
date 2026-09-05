import { useState, useCallback, useRef } from 'react';
import type { SearchParams, SearchResult, NeighborhoodCommute, Listing, SourceId } from '../types';
import type { ApiListing } from '../api/types';
import { fetchListings } from '../api/client';
import { SEARCH_SOURCES } from '../data/sources';
import { getMetroById } from '../data/metros';
import { haversineDistance, getCommuteColor, geocodeOfficeAddress } from '../utils/commute';

const SOURCE_COLORS: Record<string, string> = {
  redfin: '#c82021',
  craigslist: '#6d28d9',
};

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

function toListing(
  listing: ApiListing,
  neighborhoods: NeighborhoodCommute[],
  metroId: string,
  index: number,
): Listing {
  const commute = neighborhoods.find((hood) => hood.name === listing.neighborhood);
  const minutes = commute?.estimatedMinutes ?? 0;
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
    address: listing.address,
    neighborhood: listing.neighborhood,
    amenities,
    sourceId: listing.sourceId as SourceId,
    sourceName: listing.sourceName,
    sourceColor: SOURCE_COLORS[listing.sourceId] ?? '#64748b',
    url: listing.url,
    imageUrl: listing.imageUrl,
    scam: listing.scam,
    commuteMinutes: minutes,
    commuteColor: getCommuteColor(minutes),
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
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const search = useCallback(async (params: SearchParams) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const metro = getMetroById(params.metros[0] ?? 'bay-area');
      if (!metro) throw new Error('Unknown metro');

      const office = geocodeOfficeAddress(params.officeAddress);
      setOfficeCoords(office);
      const officeLoc = office ?? { lat: metro.defaultOffice.lat, lng: metro.defaultOffice.lng };

      const neighborhoods: NeighborhoodCommute[] = metro.neighborhoods
        .map((hood) => {
          const dist = haversineDistance(hood.lat, hood.lng, officeLoc.lat, officeLoc.lng);
          const minutes = Math.round((dist / 12) * 60 + 5);
          return {
            name: hood.name,
            lat: hood.lat,
            lng: hood.lng,
            distanceMiles: Math.round(dist * 10) / 10,
            estimatedMinutes: minutes,
            commuteColor: getCommuteColor(minutes),
          };
        })
        .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

      const response = await fetchListings(
        {
          minRent: params.minRent,
          maxRent: params.maxRent,
          bedrooms: params.bedrooms,
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
        bedrooms: params.bedrooms,
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
          listings: response.listings.map((listing, index) =>
            toListing(listing, neighborhoods, metro.id, index),
          ),
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
    officeCoords,
    search,
  };
}
