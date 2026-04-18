import type { ScoredListing } from '../types';
import { CommuteBadge } from './CommuteBadge';

interface Props {
  listing: ScoredListing;
  onToggleFavorite: (id: string) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  zillow: 'text-blue-400',
  'apartments.com': 'text-purple-400',
  craigslist: 'text-green-400',
  trulia: 'text-orange-400',
  redfin: 'text-red-400',
};

export function ListingCard({ listing, onToggleFavorite }: Props) {
  const bedroomLabel = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} BR`;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden hover:border-slate-500 transition-colors group">
      {/* Hero banner with price and key stats */}
      <div className="relative h-36 overflow-hidden" style={{
        background: `linear-gradient(135deg, hsl(${(listing.price * 7) % 360}, 25%, 18%) 0%, hsl(${(listing.price * 7 + 40) % 360}, 30%, 12%) 100%)`,
      }}>
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <span className="text-2xl font-bold text-white">${listing.price.toLocaleString()}<span className="text-sm font-normal text-slate-300">/mo</span></span>
          </div>
          <div className="flex gap-3 text-sm">
            <span className="bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} BR`}</span>
            <span className="bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.sqft.toLocaleString()} sqft</span>
            <span className="bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.neighborhood}</span>
          </div>
        </div>

        {/* Favorite button */}
        <button
          onClick={() => onToggleFavorite(listing.id)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
          aria-label={listing.isFavorite ? 'Unsave' : 'Save'}
        >
          <svg
            className={`w-5 h-5 ${listing.isFavorite ? 'text-red-400 fill-red-400' : 'text-slate-300'}`}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            fill={listing.isFavorite ? 'currentColor' : 'none'}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Source count badge */}
        {listing.sourceCount > 1 && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-600/80 text-xs font-medium text-white">
            Seen on {listing.sourceCount} sites
          </div>
        )}

        {/* Commute badge */}
        <div className="absolute bottom-2 right-2">
          <CommuteBadge
            minutes={listing.commute.estimatedMinutes}
            color={listing.commuteColor}
            method={listing.commute.method}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-100 leading-tight line-clamp-1">{listing.title}</h3>
          <span className="text-lg font-bold text-emerald-400 whitespace-nowrap">
            ${listing.price.toLocaleString()}
          </span>
        </div>

        <p className="text-sm text-slate-400">{listing.address}, {listing.neighborhood}</p>

        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span>{bedroomLabel}</span>
          <span className="text-slate-600">|</span>
          <span>{listing.bathrooms} BA</span>
          <span className="text-slate-600">|</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">${listing.pricePerSqft}/sqft</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{listing.commute.distanceMiles} mi away</span>
          <span>|</span>
          <span>Posted {listing.datePosted}</span>
        </div>

        {/* Amenity pills */}
        <div className="flex flex-wrap gap-1 pt-1">
          {listing.amenities.slice(0, 4).map(a => (
            <span key={a} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
              {a}
            </span>
          ))}
          {listing.amenities.length > 4 && (
            <span className="px-2 py-0.5 text-slate-500 text-xs">
              +{listing.amenities.length - 4} more
            </span>
          )}
        </div>

        {/* Sources */}
        <div className="flex items-center gap-2 text-xs pt-1">
          {listing.sources.map(s => (
            <span key={s} className={SOURCE_COLORS[s] ?? 'text-slate-400'}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
