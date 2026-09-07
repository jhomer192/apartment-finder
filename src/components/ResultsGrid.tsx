import { useMemo, useRef, useState } from 'react';
import type { Listing, SortOption } from '../types';
import { ListingCard } from './ListingCard';
import { pricePerBedroom } from '../utils/rooms';

interface Props {
  listings: Listing[];
  /** The search these listings came from; a new one starts back at page one. */
  searchKey: unknown;
  sort: SortOption;
  onClearNeighborhoods: () => void;
  onShowShortlist: () => void;
}

/** Listings without square footage sort last rather than polluting the top. */
function pricePerSqft(listing: Listing): number {
  return listing.sqft ? listing.price / listing.sqft : Infinity;
}

/** Listings we hold no civic data for sort last rather than looking like the best block. */
function transitDistance(listing: Listing): number {
  return listing.area?.transit?.meters ?? Infinity;
}

function incidentRate(listing: Listing): number {
  return listing.area?.incidents?.ratePer100k ?? Infinity;
}

function safetyRank(listing: Listing): number {
  return -(listing.area?.safety?.quieterThanPercent ?? -1);
}

function sortListings(listings: Listing[], sort: SortOption): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'scam-desc':
      return copy.sort((a, b) => b.scam.score - a.scam.score);
    case 'sqft-desc':
      return copy.sort((a, b) => (b.sqft ?? 0) - (a.sqft ?? 0));
    case 'ppsqft':
      return copy.sort((a, b) => pricePerSqft(a) - pricePerSqft(b));
    case 'ppbed':
      return copy.sort((a, b) => pricePerBedroom(a) - pricePerBedroom(b));
    case 'scam':
      return copy.sort((a, b) => a.scam.score - b.scam.score || a.price - b.price);
    case 'transit':
      return copy.sort((a, b) => transitDistance(a) - transitDistance(b));
    case 'incidents':
      return copy.sort((a, b) => incidentRate(a) - incidentRate(b));
    case 'safety':
      return copy.sort((a, b) => safetyRank(a) - safetyRank(b));
    default:
      return copy;
  }
}

/** Two columns of cards, each carrying a live map, is a page; more and the scroll is endless. */
const PAGE_SIZE = 20;

function Pager({
  page,
  pages,
  total,
  onPage,
  onShowShortlist,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
  onShowShortlist: () => void;
}) {
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const buttonStyle = { borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          className="px-2.5 py-1 rounded-lg border font-medium disabled:opacity-40"
          style={buttonStyle}
        >
          ‹ Prev
        </button>
        <span className="px-1">
          Page{' '}
          <select
            value={page}
            onChange={(event) => onPage(Number(event.target.value))}
            aria-label="Page"
            className="px-1.5 py-1 rounded-lg border bg-transparent"
            style={buttonStyle}
          >
            {Array.from({ length: pages }, (_, index) => (
              <option key={index} value={index}>
                {index + 1}
              </option>
            ))}
          </select>{' '}
          of {pages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages - 1}
          className="px-2.5 py-1 rounded-lg border font-medium disabled:opacity-40"
          style={buttonStyle}
        >
          Next ›
        </button>
        <button
          type="button"
          onClick={onShowShortlist}
          className="px-2.5 py-1 rounded-lg border font-medium"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          Jump to saved
        </button>
      </div>
    </div>
  );
}

export function ResultsGrid({ listings, searchKey, sort, onClearNeighborhoods, onShowShortlist }: Props) {
  const sorted = useMemo(() => sortListings(listings, sort), [listings, sort]);
  // The page is remembered against the search and sort it was turned in; a new
  // search or sort starts over at page one. Not keyed on `listings`, because a
  // dislike vote changes that array without changing the search.
  const [paging, setPaging] = useState<{ searchKey: unknown; sort: SortOption; page: number }>({
    searchKey,
    sort,
    page: 0,
  });
  const top = useRef<HTMLDivElement>(null);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = paging.searchKey === searchKey && paging.sort === sort ? paging.page : 0;
  // A vote that hides the last card on the final page must not strand the reader.
  const current = Math.min(page, pages - 1);
  const pageListings = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  function goTo(next: number) {
    setPaging({ searchKey, sort, page: Math.max(0, Math.min(pages - 1, next)) });
    // The header is sticky, so land just under it rather than behind it.
    const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 130;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  return (
    <div ref={top} className="space-y-4">
      {sorted.length > 0 && (
        <Pager page={current} pages={pages} total={sorted.length} onPage={goTo} onShowShortlist={onShowShortlist} />
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5">
        {pageListings.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {sorted.length > PAGE_SIZE && (
        <Pager page={current} pages={pages} total={sorted.length} onPage={goTo} onShowShortlist={onShowShortlist} />
      )}

      {listings.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            Nothing here right now. Try a wider budget, or put the neighborhoods back.
          </p>
          <button
            type="button"
            onClick={onClearNeighborhoods}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
          >
            Show every neighborhood
          </button>
        </div>
      )}
    </div>
  );
}
