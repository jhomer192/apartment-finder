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
    <div
      role="link"
      tabIndex={0}
      onClick={() => window.open(listing.url, '_blank', 'noopener,noreferrer')}
      onKeyDown={(e) => { if (e.key === 'Enter') window.open(listing.url, '_blank', 'noopener,noreferrer'); }}
      className="block rounded-xl border overflow-hidden transition-colors group cursor-pointer"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-dim)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Photo + overlay */}
      <div className="relative h-44 overflow-hidden" style={{
        background: `linear-gradient(135deg, hsl(${(listing.price * 7) % 360}, 25%, 18%) 0%, hsl(${(listing.price * 7 + 40) % 360}, 30%, 12%) 100%)`,
      }}>
        {listing.photoUrl && (
          <img
            src={listing.photoUrl}
            alt={listing.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <span className="text-2xl font-bold text-white drop-shadow-lg">${listing.price.toLocaleString()}<span className="text-sm font-normal text-white/80">/mo</span></span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} BR`}</span>
            <span className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.sqft.toLocaleString()} sqft</span>
            <span className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-white">{listing.neighborhood}</span>
          </div>
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(listing.id); }}
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
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-2) 80%, transparent)' }}>
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
          <h3 className="text-lg font-semibold leading-tight line-clamp-1" style={{ color: 'var(--text)' }}>{listing.title}</h3>
          <span className="text-lg font-bold whitespace-nowrap" style={{ color: 'var(--accent)' }}>
            ${listing.price.toLocaleString()}
          </span>
        </div>

        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{listing.address}, {listing.neighborhood}</p>

        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text)' }}>
          <span>{bedroomLabel}</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>{listing.bathrooms} BA</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span style={{ color: 'var(--text-dim)' }}>${listing.pricePerSqft}/sqft</span>
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          <span>{listing.commute.distanceMiles} mi away</span>
          <span>|</span>
          <span>Posted {listing.datePosted}</span>
        </div>

        {/* Amenity pills */}
        <div className="flex flex-wrap gap-1 pt-1">
          {listing.amenities.slice(0, 4).map(a => (
            <span key={a} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
              {a}
            </span>
          ))}
          {listing.amenities.length > 4 && (
            <span className="px-2 py-0.5 text-xs" style={{ color: 'var(--text-dim)' }}>
              +{listing.amenities.length - 4} more
            </span>
          )}
        </div>

        {/* Sources + View link */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            {listing.sources.map(s => (
              <span key={s} className={SOURCE_COLORS[s] ?? ''} style={!SOURCE_COLORS[s] ? { color: 'var(--text-dim)' } : undefined}>
                {s}
              </span>
            ))}
          </div>
          <span style={{ color: 'var(--accent)' }} className="font-medium">
            View Listing &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}
