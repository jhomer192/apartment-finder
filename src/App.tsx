import { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { SourcesGrid } from './components/SourcesGrid';
import { MapView } from './components/MapView';
import { ThemePicker } from './components/ThemePicker';
import { useSearch } from './hooks/useSearch';

type ViewMode = 'sources' | 'map';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('sources');
  const {
    results,
    loading,
    error,
    hasSearched,
    officeCoords,
    search,
  } = useSearch();

  const totalNeighborhoods = results.reduce((s, r) => s + r.neighborhoods.length, 0);
  const totalSources = results.length > 0 ? results[0].sources.length : 0;

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
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{totalSources}</span> search engines across{' '}
                <span className="font-medium" style={{ color: 'var(--text)' }}>{results.length}</span> metro{results.length !== 1 ? 's' : ''}{' '}
                <span style={{ color: 'var(--text-dim)' }}>({totalNeighborhoods} neighborhoods)</span>
              </p>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border p-0.5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setViewMode('sources')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={viewMode === 'sources'
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
                    Sources
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
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

            {/* Main content */}
            {viewMode === 'sources' ? (
              <SourcesGrid results={results} />
            ) : (
              <div className="space-y-4">
                <MapView results={results} officeCoords={officeCoords} />
                {/* Commute legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: 'var(--text-dim)' }}>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>Commute estimate:</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> &lt; 15 min</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> 15-30 min</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> 30-45 min</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> 45+ min</span>
                </div>
                {/* Neighborhood commute table */}
                {results.map(result => (
                  <div key={result.metroId} className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{result.metroName} — Commute Times</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px" style={{ backgroundColor: 'var(--border)' }}>
                      {result.neighborhoods.map(hood => {
                        const colorMap = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
                        return (
                          <div key={hood.name} className="px-3 py-2.5" style={{ backgroundColor: 'var(--surface)' }}>
                            <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{hood.name}</div>
                            <div className="text-xs font-semibold mt-0.5" style={{ color: colorMap[hood.commuteColor] }}>
                              ~{hood.estimatedMinutes} min
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{hood.distanceMiles} mi</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {hasSearched && !loading && results.length === 0 && !error && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-dim)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg" style={{ color: 'var(--text-dim)' }}>No metro areas selected</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Select at least one metro area to search</p>
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
              Enter your metro area, budget, and office address above. We'll generate pre-filled search links
              across 9 apartment sites and show commute times to every neighborhood.
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
            <p style={{ color: 'var(--text-dim)' }}>Building search links...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
          Apartment Finder — Search aggregator across 9 rental sites. Commute times are estimates based on straight-line distance.
        </div>
      </footer>
    </div>
  );
}
