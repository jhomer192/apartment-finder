import { useState, useCallback } from 'react';
import type { SearchParams, ScoredListing, SortField, SortDirection, FilterState } from '../types';
import { searchAllSources } from '../sources';
import { deduplicateListings } from '../utils/deduplicate';
import { calculateCommute, geocodeOfficeAddress, getCommuteColor } from '../utils/commute';
import { getFavorites, toggleFavorite as toggleFav } from '../utils/favorites';

export function useSearch() {
  const [results, setResults] = useState<ScoredListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('commute');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filters, setFilters] = useState<FilterState>({ amenities: new Set() });
  const [favorites, setFavorites] = useState<Set<string>>(getFavorites);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const listings = await searchAllSources(params);
      const merged = deduplicateListings(listings);

      const officeCoords = geocodeOfficeAddress(params.officeAddress);
      if (!officeCoords) {
        setError('Could not geocode office address. Using downtown as fallback.');
      }
      const office = officeCoords ?? { lat: 37.7749, lng: -122.4194 };

      const favs = getFavorites();
      setFavorites(favs);

      const scored: ScoredListing[] = await Promise.all(
        merged.map(async (listing) => {
          const commute = await calculateCommute(
            listing.lat, listing.lng,
            office.lat, office.lng,
          );
          const pricePerSqft = listing.sqft > 0
            ? Math.round((listing.price / listing.sqft) * 100) / 100
            : 0;
          return {
            ...listing,
            commute,
            pricePerSqft,
            commuteColor: getCommuteColor(commute.estimatedMinutes),
            isFavorite: favs.has(listing.id),
          };
        })
      );

      setResults(scored);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const newFavs = toggleFav(id);
    setFavorites(newFavs);
    setResults(prev =>
      prev.map(r => ({
        ...r,
        isFavorite: newFavs.has(r.id),
      }))
    );
  }, []);

  const toggleAmenityFilter = useCallback((amenity: string) => {
    setFilters(prev => {
      const next = new Set(prev.amenities);
      if (next.has(amenity)) {
        next.delete(amenity);
      } else {
        next.add(amenity);
      }
      return { ...prev, amenities: next };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ amenities: new Set() });
  }, []);

  // Apply filters and sort
  const filtered = results.filter(listing => {
    if (filters.amenities.size === 0) return true;
    return [...filters.amenities].every(a =>
      listing.amenities.some(la => la.toLowerCase().includes(a.toLowerCase()))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'price':
        cmp = a.price - b.price;
        break;
      case 'commute':
        cmp = a.commute.estimatedMinutes - b.commute.estimatedMinutes;
        break;
      case 'sqft':
        cmp = a.sqft - b.sqft;
        break;
      case 'pricePerSqft':
        cmp = a.pricePerSqft - b.pricePerSqft;
        break;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  return {
    results: sorted,
    allResults: results,
    loading,
    error,
    hasSearched,
    sortField,
    sortDirection,
    filters,
    favorites,
    search,
    setSortField,
    setSortDirection,
    toggleFavorite,
    toggleAmenityFilter,
    clearFilters,
  };
}
