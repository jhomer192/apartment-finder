import { useState, useEffect } from 'react';
import type { Listing } from '../types';

interface Props {
  listing: Listing;
}

const COMMUTE_COLORS: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

function getFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem('apartment-finder-favorites');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setFavorites(favs: Set<string>) {
  localStorage.setItem('apartment-finder-favorites', JSON.stringify([...favs]));
}

export function ListingCard({ listing }: Props) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setFav(getFavorites().has(listing.id));
  }, [listing.id]);

  function toggleFav() {
    const favs = getFavorites();
    if (favs.has(listing.id)) {
      favs.delete(listing.id);
    } else {
      favs.add(listing.id);
    }
    setFavorites(favs);
    setFav(favs.has(listing.id));
  }

  const ppsqft = Math.round(listing.price / listing.sqft * 100) / 100;
  const bedsLabel = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bd`;
  const bathsLabel = listing.bathrooms % 1 === 0 ? `${listing.bathrooms} ba` : `${listing.bathrooms} ba`;
  const commuteColor = COMMUTE_COLORS[listing.commuteColor] ?? '#94a3b8';

  return (
    <div
      className="rounded-xl border overflow-hidden transition-all hover:shadow-lg"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Gradient banner */}
      <div
        className="relative h-36 flex flex-col justify-end p-4"
        style={{
          background: `linear-gradient(135deg, ${listing.gradientFrom}, ${listing.gradientTo})`,
        }}
      >
        {/* Favorite heart */}
        <button
          onClick={toggleFav}
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill={fav ? '#ef4444' : 'none'}
            stroke={fav ? '#ef4444' : 'white'}
            strokeWidth={2}
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        {/* Commute badge */}
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
          style={{
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            color: commuteColor,
          }}
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: commuteColor }}
          />
          ~{listing.commuteMinutes} min
        </div>

        {/* Price and stats overlay */}
        <div className="relative z-10">
          <div className="text-2xl font-bold text-white">
            ${listing.price.toLocaleString()}<span className="text-sm font-normal opacity-80">/mo</span>
          </div>
          <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
            <span>{bedsLabel}</span>
            <span className="opacity-50">|</span>
            <span>{bathsLabel}</span>
            <span className="opacity-50">|</span>
            <span>{listing.sqft.toLocaleString()} sqft</span>
          </div>
        </div>

        {/* Neighborhood label */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-xs font-medium text-white/90"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          {listing.neighborhood}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--text)' }}>
          {listing.title}
        </h3>

        {/* Address */}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {listing.address}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          <span>{bedsLabel} / {bathsLabel}</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
          <span>${ppsqft.toFixed(2)}/sqft</span>
        </div>

        {/* Amenity pills */}
        <div className="flex flex-wrap gap-1.5">
          {listing.amenities.slice(0, 5).map(a => (
            <span
              key={a}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              }}
            >
              {a}
            </span>
          ))}
          {listing.amenities.length > 5 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ color: 'var(--text-dim)' }}
            >
              +{listing.amenities.length - 5} more
            </span>
          )}
        </div>

        {/* Source + CTA */}
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs"
              style={{ backgroundColor: listing.sourceColor }}
            >
              {listing.sourceName[0]}
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
              {listing.sourceName}
            </span>
          </div>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: listing.sourceColor,
              color: '#fff',
            }}
          >
            View Listing
            <svg className="inline-block w-3 h-3 ml-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
