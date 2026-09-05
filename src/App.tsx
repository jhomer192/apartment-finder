import { useState, useMemo, useEffect } from 'react';
import { SearchForm } from './components/SearchForm';
import { DEFAULT_SEARCH } from './data/search';
import { ResultsGrid } from './components/ResultsGrid';
import { NeighborhoodFilter } from './components/NeighborhoodFilter';
import { SourceLinksBar } from './components/SourceLinksBar';
import { MapView } from './components/MapView';
import { ThemePicker } from './components/ThemePicker';
import { ClaudeSearch } from './components/ClaudeSearch';
import { AlertSettings } from './components/AlertSettings';
import { SignInGate } from './components/SignInGate';
import { SourceStatusBar } from './components/SourceStatusBar';
import { ShortlistProvider } from './components/ShortlistProvider';
import { ShortlistPanel } from './components/ShortlistPanel';
import { useSearch } from './hooks/useSearch';
import { useAuth } from './hooks/useAuth';
import { useStickyState } from './hooks/useStickyState';

type ViewMode = 'listings' | 'map';

const parseNeighborhoods = (raw: string): Set<string> => new Set(JSON.parse(raw) as string[]);
const serializeNeighborhoods = (value: Set<string>): string => JSON.stringify([...value]);

export default function App() {
  const { user, loading: authLoading, error: authError, signOut } = useAuth();
  return authLoading || !user ? (
    <Gate loading={authLoading} error={authError} />
  ) : (
    <ShortlistProvider>
      <Finder email={user.email} signOut={signOut} />
    </ShortlistProvider>
  );
}

function Gate({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          Checking your invite…
        </p>
      </div>
    );
  }
  return <SignInGate error={error} />;
}

function Finder({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const [viewMode, setViewMode] = useState<ViewMode>('listings');
  const [neighborhoods, setNeighborhoods] = useStickyState<Set<string>>(
    'neighborhoods',
    new Set(),
    parseNeighborhoods,
    serializeNeighborhoods,
  );
  const {
    results,
    loading,
    error,
    hasSearched,
    search,
  } = useSearch();

  useEffect(() => {
    search(DEFAULT_SEARCH);
  }, [search]);

  const result = results[0] ?? null;

  const visibleListings = useMemo(() => {
    if (!result) return [];
    if (neighborhoods.size === 0) return result.listings;
    return result.listings.filter(l => neighborhoods.has(l.neighborhood));
  }, [result, neighborhoods]);

  const neighborhoodCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of result?.listings ?? []) {
      counts.set(listing.neighborhood, (counts.get(listing.neighborhood) ?? 0) + 1);
    }
    return counts;
  }, [result]);

  const occupiedNeighborhoods = useMemo(
    () => [...neighborhoodCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
    [neighborhoodCounts],
  );

  function handleSearch(params: Parameters<typeof search>[0]) {
    search(params);
    setNeighborhoods(new Set());
  }

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
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-dim)' }}>
              {email}
            </span>
            <button
              onClick={() => void signOut()}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              Sign out
            </button>
            <ThemePicker />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <ClaudeSearch />

        <SearchForm onSearch={handleSearch} loading={loading} />

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results section */}
        {hasSearched && !loading && result && (
          <>
            <SourceStatusBar sources={result.sourceStatuses} />

            {/* Controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{visibleListings.length}</span> apartment{visibleListings.length !== 1 ? 's' : ''} in San Francisco
              </p>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border p-0.5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <button
                  onClick={() => setViewMode('listings')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={viewMode === 'listings'
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
                    Listings
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

            <NeighborhoodFilter
              neighborhoods={occupiedNeighborhoods}
              selected={neighborhoods}
              onChange={setNeighborhoods}
              counts={neighborhoodCounts}
            />

            {viewMode === 'listings' ? (
              <div className="space-y-4">
                <ResultsGrid listings={visibleListings} onClearNeighborhoods={() => setNeighborhoods(new Set())} />
                <SourceLinksBar sources={result.sources} />
              </div>
            ) : (
              <MapView listings={visibleListings} centerLat={result.centerLat} centerLng={result.centerLng} />
            )}
          </>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-20">
            <svg className="animate-spin w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent-2)' }} viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p style={{ color: 'var(--text-dim)' }}>Loading San Francisco apartments…</p>
          </div>
        )}

        <ShortlistPanel />

        <AlertSettings />
      </main>

      {/* Footer */}
      <footer className="border-t mt-12" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
          Live listings pulled from the sources above. Scam scores are heuristics plus a Claude review —
          treat them as a prompt to look closer, not proof either way.
        </div>
      </footer>
    </div>
  );
}
