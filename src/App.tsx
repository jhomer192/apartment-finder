import { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { SortControls } from './components/SortControls';
import { FilterSidebar } from './components/FilterSidebar';
import { ResultsGrid } from './components/ResultsGrid';
import { MapView } from './components/MapView';
import { ThemePicker } from './components/ThemePicker';
import { useSearch } from './hooks/useSearch';

type ViewMode = 'grid' | 'map';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const {
    results,
    allResults,
    loading,
    error,
    hasSearched,
    sortField,
    sortDirection,
    filters,
    search,
    setSortField,
    setSortDirection,
    toggleFavorite,
    toggleAmenityFilter,
    clearFilters,
  } = useSearch();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-30 backdrop-blur-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <svg className="w-7 h-7" style={{ color: 'var(--accent-2)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <polyline points="9,22 9,12 15,12 15,22" />
          </svg>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Apartment Finder</h1>
          <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ color: 'var(--text-dim)', backgroundColor: 'var(--surface)' }}>Demo</span>
          <div className="ml-auto">
            <ThemePicker />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search form */}
        <SearchForm onSearch={search} loading={loading} />

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results section */}
        {hasSearched && !loading && results.length > 0 && (
          <>
            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <SortControls
                sortField={sortField}
                sortDirection={sortDirection}
                onSortFieldChange={setSortField}
                onSortDirectionChange={setSortDirection}
                resultCount={results.length}
                totalCount={allResults.length}
              />

              {/* View toggle */}
              <div className="flex items-center rounded-lg border p-0.5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors`}
                  style={viewMode === 'grid'
                    ? { backgroundColor: 'var(--border)', color: 'var(--text)' }
                    : { color: 'var(--text-dim)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Grid
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors`}
                  style={viewMode === 'map'
                    ? { backgroundColor: 'var(--border)', color: 'var(--text)' }
                    : { color: 'var(--text-dim)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Map
                  </span>
                </button>
              </div>
            </div>

            {/* Main content with sidebar */}
            <div className="flex gap-6">
              {/* Filter sidebar */}
              <div className="hidden lg:block w-64 flex-shrink-0">
                <div className="sticky top-20">
                  <FilterSidebar
                    filters={filters}
                    onToggleAmenity={toggleAmenityFilter}
                    onClear={clearFilters}
                    listings={allResults}
                  />
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 min-w-0">
                {viewMode === 'grid' ? (
                  <ResultsGrid listings={results} onToggleFavorite={toggleFavorite} />
                ) : (
                  <MapView listings={results} onToggleFavorite={toggleFavorite} />
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {hasSearched && !loading && results.length === 0 && !error && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-dim)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg" style={{ color: 'var(--text-dim)' }}>No apartments found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Try expanding your price range or changing the city</p>
          </div>
        )}

        {/* Initial state */}
        {!hasSearched && (
          <div className="text-center py-20">
            <svg className="w-20 h-20 mx-auto mb-6" style={{ color: 'var(--border)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Find your next apartment</h2>
            <p className="max-w-md mx-auto" style={{ color: 'var(--text-dim)' }}>
              Enter your city, budget, and office address above. We'll search across multiple listing sites
              and score each apartment by commute time.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-20">
            <svg className="animate-spin w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent-2)' }} viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p style={{ color: 'var(--text-dim)' }}>Searching listing sources...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
          Apartment Finder — Demo with mock data. Pluggable data source architecture for real integrations.
        </div>
      </footer>
    </div>
  );
}
