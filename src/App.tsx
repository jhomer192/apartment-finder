import { useState, useMemo, useEffect, useCallback } from 'react';
import type { SavedFilter } from './api/types';
import type { SearchParams, SortOption } from './types';
import { SearchForm } from './components/SearchForm';
import { SavedFilters } from './components/SavedFilters';
import { DEFAULT_SEARCH } from './data/search';
import { ResultsGrid } from './components/ResultsGrid';
import { SourceLinksBar } from './components/SourceLinksBar';
import { MapView } from './components/MapView';
import { ThemePicker } from './components/ThemePicker';
import { ClaudeSearch } from './components/ClaudeSearch';
import { AlertSettings } from './components/AlertSettings';
import { HouseRulesBar } from './components/HouseRules';
import { SignInGate } from './components/SignInGate';
import { SourceStatusBar } from './components/SourceStatusBar';
import { InventoryBar } from './components/InventoryBar';
import { ShortlistProvider } from './components/ShortlistProvider';
import { DislikesProvider } from './components/DislikesProvider';
import { ShortlistPanel } from './components/ShortlistPanel';
import { PasswordPanel } from './components/PasswordPanel';
import { CommuteBar } from './components/CommuteBar';
import { SettingsDrawer, DrawerSection } from './components/SettingsDrawer';
import { useSearch } from './hooks/useSearch';
import { useShortlist } from './hooks/useShortlist';
import { useDislikes } from './hooks/useDislikes';
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
      <DislikesProvider>
        <Finder email={user.email} hasPassword={user.hasPassword ?? false} signOut={signOut} onPasswordSet={refresh} />
      </DislikesProvider>
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const [showHidden, setShowHidden] = useState(false);
  const { saved } = useShortlist();
  const dislikes = useDislikes();
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

  function showShortlist() {
    setShortlistOpen(true);
    // Defer so a freshly opened panel has rendered before we scroll to it.
    requestAnimationFrame(() => {
      document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const rerunSearch = useCallback(() => {
    search(activeSearch);
  }, [search, activeSearch]);

  const result = results[0] ?? null;

  const inNeighborhoods = useMemo(() => {
    if (!result) return [];
    if (neighborhoods.size === 0) return result.listings;
    return result.listings.filter(l => neighborhoods.has(l.neighborhood));
  }, [result, neighborhoods]);

  // Voted off by the group: kept out of the list unless someone asks to see them.
  const hiddenCount = useMemo(
    () => inNeighborhoods.filter((l) => dislikes.isHidden(l.id)).length,
    [inNeighborhoods, dislikes],
  );
  const visibleListings = useMemo(
    () => (showHidden ? inNeighborhoods : inNeighborhoods.filter((l) => !dislikes.isHidden(l.id))),
    [inNeighborhoods, dislikes, showHidden],
  );

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
  }

  function handleClearAll() {
    handleSearch(DEFAULT_SEARCH);
    setNeighborhoods(new Set());
  }

  /** A saved search restores the neighborhoods and the sort too, not just the numbers. */
  function applySavedFilter(filter: SavedFilter) {
    const params: SearchParams = {
      minRent: filter.minRent,
      maxRent: filter.maxRent,
      minBedrooms: filter.minBedrooms,
      maxBedrooms: filter.maxBedrooms,
      minBathrooms: filter.minBathrooms,
      maxBathrooms: filter.maxBathrooms,
      dedupe: filter.dedupe,
    };
    setActiveSearch(params);
    search(params);
    setNeighborhoods(new Set(filter.neighborhoods));
    setSort(filter.sort);
  }

  const activeFilters = filterLabels(activeSearch, neighborhoods);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Header: brand, filter pills and the two things people reach for — Saved and their account. */}
      <header
        className="lg:sticky top-0 z-30 border-b"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <a href="#top" className="flex items-center gap-2 shrink-0" style={{ color: 'var(--accent)' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            <span className="text-lg font-bold tracking-tight hidden sm:inline" style={{ color: 'var(--text)' }}>
              Apartment Finder
            </span>
          </a>

          <div className="hidden lg:block flex-1 min-w-0">
            <SearchForm
              params={activeSearch}
              onSearch={handleSearch}
              onClearAll={handleClearAll}
              loading={loading}
              neighborhoods={occupiedNeighborhoods}
              selectedNeighborhoods={neighborhoods}
              onNeighborhoods={setNeighborhoods}
              neighborhoodCounts={neighborhoodCounts}
              sort={sort}
              onSort={setSort}
            />
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button onClick={showShortlist} className="pill" title="Your group's saved listings">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={saved.length > 0 ? '#ef4444' : 'none'} stroke={saved.length > 0 ? '#ef4444' : 'currentColor'} strokeWidth={2}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              Saved{saved.length > 0 ? ` ${saved.length}` : ''}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="pill"
              aria-label="Open settings"
              title={email}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ backgroundColor: 'var(--accent)' }}
                aria-hidden
              >
                {email[0]?.toUpperCase()}
              </span>
            </button>
          </div>
        </div>

        {/* Filters drop under the brand on smaller screens. */}
        <div className="lg:hidden max-w-[1600px] mx-auto px-4 sm:px-6 pb-3">
          <SearchForm
            params={activeSearch}
            onSearch={handleSearch}
            onClearAll={handleClearAll}
            loading={loading}
            neighborhoods={occupiedNeighborhoods}
            selectedNeighborhoods={neighborhoods}
            onNeighborhoods={setNeighborhoods}
            neighborhoodCounts={neighborhoodCounts}
            sort={sort}
            onSort={setSort}
          />
        </div>
      </header>

      <main id="top" className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        <ClaudeSearch />

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {hasSearched && !loading && result && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)] lg:gap-5 lg:items-start">
            {/* Listings column */}
            <section className={`space-y-4 ${viewMode === 'map' ? 'hidden lg:block' : ''}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {visibleListings.length.toLocaleString()} apartment{visibleListings.length !== 1 ? 's' : ''} in San Francisco
                </h2>
                {activeFilters.length > 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {activeFilters.join(' · ')}
                  </p>
                )}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHidden((current) => !current)}
                    className="text-xs font-medium underline"
                    style={{ color: 'var(--text-dim)' }}
                    title={`Listings ${dislikes.hideAfter} or more of you disliked`}
                  >
                    {showHidden ? `Hide ${hiddenCount} disliked listings` : `${hiddenCount} hidden by the group · show`}
                  </button>
                )}
              </div>

              <ResultsGrid
                listings={visibleListings}
                searchKey={inNeighborhoods}
                sort={sort}
                onClearNeighborhoods={() => setNeighborhoods(new Set())}
                onShowShortlist={showShortlist}
              />
              <SourceLinksBar sources={result.sources} />
            </section>

            {/* Map column: rides along on desktop, swaps in for the list on phones. */}
            <aside className={`lg:sticky lg:top-[73px] ${viewMode === 'map' ? '' : 'hidden lg:block'}`}>
              <MapView
                listings={visibleListings}
                centerLat={result.centerLat}
                centerLng={result.centerLng}
                className="h-[70vh] lg:h-[calc(100vh-170px)]"
              />
            </aside>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <svg className="animate-spin w-10 h-10 mx-auto mb-4" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p style={{ color: 'var(--text-dim)' }}>Loading San Francisco apartments…</p>
          </div>
        )}

        <ShortlistPanel open={shortlistOpen} onOpenChange={setShortlistOpen} />
      </main>

      {/* Phones: floating List / Map switch, the way Zillow does it. */}
      {hasSearched && !loading && result && (
        <div className="lg:hidden fixed bottom-5 inset-x-0 z-20 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setViewMode((current) => (current === 'map' ? 'listings' : 'map'));
              window.scrollTo({ top: 0 });
            }}
            className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: 'var(--text)', color: 'var(--surface)' }}
          >
            {viewMode === 'map' ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Show list
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Show map
              </>
            )}
          </button>
        </div>
      )}

      <SettingsDrawer open={settingsOpen} onClose={closeSettings} email={email} onSignOut={() => void signOut()}>
        <HouseRulesBar onSaved={rerunSearch} />
        <SavedFilters current={{ ...activeSearch, neighborhoods: [...neighborhoods], sort }} onApply={applySavedFilter} />
        <DrawerSection title="Commute" hint="Every listing gets a Google Maps directions link to this address.">
          <CommuteBar />
        </DrawerSection>
        <AlertSettings />
        <DrawerSection title="Listing sources" hint="Refreshed nightly; refresh by hand if you want the latest right now.">
          <InventoryBar onRefreshed={rerunSearch} />
          {result && <SourceStatusBar sources={result.sourceStatuses} />}
        </DrawerSection>
        <DrawerSection title="Password">
          <PasswordPanel hasPassword={hasPassword} onPasswordSet={onPasswordSet} />
        </DrawerSection>
        <DrawerSection title="Theme">
          <ThemePicker />
        </DrawerSection>
      </SettingsDrawer>

      <footer className="border-t mt-12" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1600px] mx-auto px-4 py-6 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
          Live listings pulled from Redfin, ApartmentList, Zumper and Rent.com. Scam scores are heuristics plus a Claude review —
          treat them as a prompt to look closer, not proof either way.
        </div>
      </footer>
    </div>
  );
}
