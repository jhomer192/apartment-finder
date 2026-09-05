import type { Listing, SortOption } from '../types';
import { ListingCard } from './ListingCard';
import { pricePerBedroom } from '../utils/rooms';

interface Props {
  listings: Listing[];
  sort: SortOption;
  onClearNeighborhoods: () => void;
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

export function ResultsGrid({ listings, sort, onClearNeighborhoods }: Props) {
  const sorted = sortListings(listings, sort);

  return (
    <div>
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
