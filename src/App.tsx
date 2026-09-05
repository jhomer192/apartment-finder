import { useState, useMemo, useEffect, useCallback } from 'react';
import type { SearchParams, SortOption } from './types';
import { SearchForm } from './components/SearchForm';
import { DEFAULT_SEARCH } from './data/search';
import { ResultsGrid } from './components/ResultsGrid';
import { SortSelect } from './components/SortSelect';
import { NeighborhoodFilter } from './components/NeighborhoodFilter';
import { SourceLinksBar } from './components/SourceLinksBar';
import { MapView } from './components/MapView';
import { ThemePicker } from './components/ThemePicker';
import { ClaudeSearch } from './components/ClaudeSearch';
import { AlertSettings } from './components/AlertSettings';
import { SignInGate } from './components/SignInGate';
import { SourceStatusBar } from './components/SourceStatusBar';
import { InventoryBar } from './components/InventoryBar';
import { ShortlistProvider } from './components/ShortlistProvider';
import { ShortlistPanel } from './components/ShortlistPanel';
import { PasswordPanel } from './components/PasswordPanel';
import { CommuteBar } from './components/CommuteBar';
import { useSearch } from './hooks/useSearch';
import { useShortlist } from './hooks/useShortlist';
import { useAuth } from './hooks/useAuth';
import { useStickyState } from './hooks/useStickyState';

type ViewMode = 'listings' | 'map';

const parseNeighborhoods = (raw: string): Set<string> => new Set(JSON.parse(raw) as string[]);
const serializeNeighborhoods = (value: Set<string>): string => JSON.stringify([...value]);
const parseSort = (raw: string): SortOption => raw as SortOption;
const serializeSort = (value: SortOption): string => value;

function roomLabel(min: number | null, max: number | null, unit: string): string | null {
  if (min === null && max === null) return null;
  if (min !== null && min === max) return `${min} ${unit}`;
  if (min === null) return `up to ${max} ${unit}`;
  if (max === null) return `${min}+ ${unit}`;
  return `${min}\u2013${max} ${unit}`;
}

/** Plain-language summary of what is narrowing the list, so nobody wonders why it is short. */
function filterLabels(params: SearchParams, neighborhoods: Set<string>): string[] {
  const labels: string[] = [];
  if (params.minRent !== DEFAULT_SEARCH.minRent || params.maxRent !== DEFAULT_SEARCH.maxRent) {
    labels.push(`$${params.minRent.toLocaleString()}\u2013$${params.maxRent.toLocaleString()}`);
  }
  const beds = roomLabel(params.minBedrooms, params.maxBedrooms, 'bd');
  if (beds) labels.push(beds);
  const baths = roomLabel(params.minBathrooms, params.maxBathrooms, 'ba');
  if (baths) labels.push(baths);
  for (const name of neighborhoods) labels.push(name);
  return labels;
}

export default function App() {
  const { user, loading: authLoading, error: authError, signOut, refresh } = useAuth();
  return authLoading || !user ? (
    <Gate loading={authLoading} error={authError} onSignedIn={refresh} />
  ) : (
    <ShortlistProvider>
      <Finder email={user.email} hasPassword={user.hasPassword ?? false} signOut={signOut} onPasswordSet={refresh} />
    </ShortlistProvider>
  );
}

function Gate({ loading, error, onSignedIn }: { loading: boolean; error: string | null; onSignedIn: () => void }) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          Checking your invite…
        </p>
      </div>
    );
  }
  return <SignInGate error={error} onSignedIn={onSignedIn} />;
}

function Finder({
  email,
  hasPassword,
  signOut,
  onPasswordSet,
}: {
  email: string;
  hasPassword: boolean;
  signOut: () => Promise<void>;
  onPasswordSet: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('listings');
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const { saved } = useShortlist();
  const [sort, setSort] = useStickyState<SortOption>('sort', 'scam', parseSort, serializeSort);
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

  const [activeSearch, setActiveSearch] = useState<SearchParams>(DEFAULT_SEARCH);

  useEffect(() => {
    search(DEFAULT_SEARCH);
  }, [search]);

  useEffect(() => {
    if (shortlistOpen) document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth' });
  }, [shortlistOpen]);

  const rerunSearch = useCallback(() => {
    search(activeSearch);
  }, [search, activeSearch]);

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

  function handleSearch(params: SearchParams) {
    setActiveSearch(params);
    search(params);
    setNeighborhoods(new Set());
  }

  function handleClearAll() {
    handleSearch(DEFAULT_SEARCH);
  }

  const activeFilters = filterLabels(activeSearch, neighborhoods);

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
              onClick={() => setShortlistOpen(true)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
            >
              Saved {saved.length}
            </button>
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

        <SearchForm onSearch={handleSearch} onClearAll={handleClearAll} loading={loading} />

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
            <InventoryBar onRefreshed={rerunSearch} />

            {/* Controls bar: count, sort, active filters and view live together so the
                results header is the one place to steer the list from. */}
            <div
              className="sticky top-[61px] z-20 -mx-4 px-4 py-3 flex flex-wrap items-center gap-3 border-b backdrop-blur-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{visibleListings.length}</span> apartment{visibleListings.length !== 1 ? 's' : ''} in San Francisco
              </p>

              {activeFilters.map((label) => (
                <span
                  key={label}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                    color: 'var(--accent)',
                  }}
                >
                  {label}
                </span>
              ))}

              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs font-medium underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Clear all
                </button>
              )}

              <div className="ml-auto flex items-center gap-3">
                <SortSelect sort={sort} onChange={setSort} />

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
            </div>

            <CommuteBar />

            <NeighborhoodFilter
              neighborhoods={occupiedNeighborhoods}
              selected={neighborhoods}
              onChange={setNeighborhoods}
              counts={neighborhoodCounts}
            />

            {viewMode === 'listings' ? (
              <div className="space-y-4">
                <ResultsGrid listings={visibleListings} sort={sort} onClearNeighborhoods={() => setNeighborhoods(new Set())} />
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

        <ShortlistPanel open={shortlistOpen} onOpenChange={setShortlistOpen} />

        <AlertSettings />

        <PasswordPanel hasPassword={hasPassword} onPasswordSet={onPasswordSet} />
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
