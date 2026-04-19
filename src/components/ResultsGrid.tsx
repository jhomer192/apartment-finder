import { useState } from 'react';
import type { Listing, SortOption } from '../types';
import { ListingCard } from './ListingCard';

interface Props {
  listings: Listing[];
  metroName: string;
}

function sortListings(listings: Listing[], sort: SortOption): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'commute':
      return copy.sort((a, b) => a.commuteMinutes - b.commuteMinutes);
    case 'sqft-desc':
      return copy.sort((a, b) => b.sqft - a.sqft);
    case 'ppsqft':
      return copy.sort((a, b) => (a.price / a.sqft) - (b.price / b.sqft));
    default:
      return copy;
  }
}

export function ResultsGrid({ listings, metroName }: Props) {
  const [sort, setSort] = useState<SortOption>('price-asc');

  const sorted = sortListings(listings, sort);

  return (
    <div>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>{listings.length}</span>{' '}
          listing{listings.length !== 1 ? 's' : ''} in {metroName}
        </p>
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
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="commute">Commute Time</option>
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
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No listings match your filters. Try adjusting your budget or selecting more neighborhoods.
          </p>
        </div>
      )}
    </div>
  );
}
