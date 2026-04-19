import { useState, useCallback } from 'react';
import type { SearchParams, SearchResult, NeighborhoodCommute } from '../types';
import { SEARCH_SOURCES } from '../data/sources';
import { getMetroById } from '../data/metros';
import { haversineDistance, getCommuteColor, geocodeOfficeAddress } from '../utils/commute';

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number } | null>(null);

  const search = useCallback((params: SearchParams) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const office = geocodeOfficeAddress(params.officeAddress);
      if (!office) {
        setError('Could not geocode office address. Using first metro center as fallback.');
      }
      setOfficeCoords(office);

      // Build a Set from selectedNeighborhoods for fast lookup
      const hoodFilter = params.selectedNeighborhoods
        ? new Set(params.selectedNeighborhoods)
        : null;

      const searchResults: SearchResult[] = params.metros.map(metroId => {
        const metro = getMetroById(metroId);
        if (!metro) throw new Error(`Unknown metro: ${metroId}`);

        const officeLoc = office ?? { lat: metro.defaultOffice.lat, lng: metro.defaultOffice.lng };

        // Build URLs for each source
        const urlParams = {
          city: metro.city,
          state: metro.state,
          citySlug: metro.citySlug,
          region: metro.region,
          minRent: params.minRent,
          maxRent: params.maxRent,
          bedrooms: params.bedrooms,
        };

        const sources = SEARCH_SOURCES.map(source => ({
          source,
          url: source.buildUrl(urlParams),
        }));

        // Filter neighborhoods by selection, then calculate commute
        const activeHoods = hoodFilter
          ? metro.neighborhoods.filter(hood => hoodFilter.has(`${metroId}::${hood.name}`))
          : metro.neighborhoods;

        const neighborhoods: NeighborhoodCommute[] = activeHoods.map(hood => {
          const dist = haversineDistance(hood.lat, hood.lng, officeLoc.lat, officeLoc.lng);
          const minutes = Math.round(dist / 12 * 60 + 5);
          return {
            name: hood.name,
            lat: hood.lat,
            lng: hood.lng,
            distanceMiles: Math.round(dist * 10) / 10,
            estimatedMinutes: minutes,
            commuteColor: getCommuteColor(minutes),
          };
        }).sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

        // Center of the selected neighborhoods (or all if none selected)
        const centerSource = activeHoods.length > 0 ? activeHoods : metro.neighborhoods;
        const centerLat = centerSource.reduce((s, n) => s + n.lat, 0) / centerSource.length;
        const centerLng = centerSource.reduce((s, n) => s + n.lng, 0) / centerSource.length;

        return {
          metroId: metro.id,
          metroName: metro.name,
          state: metro.state,
          city: metro.city,
          citySlug: metro.citySlug,
          region: metro.region,
          centerLat,
          centerLng,
          sources,
          neighborhoods,
        };
      });

      setResults(searchResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
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
