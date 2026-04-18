import type { ScoredListing } from '../types';
import { ListingCard } from './ListingCard';

interface Props {
  listings: ScoredListing[];
  onToggleFavorite: (id: string) => void;
}

export function ResultsGrid({ listings, onToggleFavorite }: Props) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-dim)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-lg" style={{ color: 'var(--text-dim)' }}>No listings match your criteria</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Try adjusting your filters or expanding the price range</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {listings.map(listing => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
