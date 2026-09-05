import type { Listing, SortOption } from '../types';
import { ListingCard } from './ListingCard';
import { useStickyState } from '../hooks/useStickyState';

interface Props {
  listings: Listing[];
  onClearNeighborhoods: () => void;
}

/** Listings without square footage sort last rather than polluting the top. */
function pricePerSqft(listing: Listing): number {
  return listing.sqft ? listing.price / listing.sqft : Infinity;
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
    case 'scam':
      return copy.sort((a, b) => a.scam.score - b.scam.score || a.price - b.price);
    default:
      return copy;
  }
}

const parseSort = (raw: string): SortOption => raw as SortOption;
const serializeSort = (value: SortOption): string => value;

export function ResultsGrid({ listings, onClearNeighborhoods }: Props) {
  const [sort, setSort] = useStickyState<SortOption>('sort', 'scam', parseSort, serializeSort);

  const sorted = sortListings(listings, sort);

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>Sort by:</label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
            className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            <option value="scam">Safest first</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="scam-desc">Riskiest first</option>
            <option value="sqft-desc">Largest</option>
            <option value="ppsqft">Price/sqft</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

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
