import { useEffect, useState } from 'react';
import type { Listing } from '../types';
import { useShortlist } from '../hooks/useShortlist';
import { ScamBadge } from './ScamBadge';
import { useCommute } from '../hooks/useCommute';
import { clockLabel, commuteUrl, googleMapsUrl } from '../utils/maps';
import { AreaFactsRow } from './AreaFactsRow';
import { pricePerBedroom } from '../utils/rooms';
import { ListingMiniMap } from './ListingMiniMap';
import { SafetyRating } from './SafetyRating';

interface Props {
  listing: Listing;
}

export function ListingCard({ listing }: Props) {
  const { keys, toggle } = useShortlist();
  const { commute } = useCommute();
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const saved = keys.has(listing.id);

  const gallery = (listing.imageUrls.length > 0
    ? listing.imageUrls
    : listing.imageUrl
      ? [listing.imageUrl]
      : []
  ).filter((url) => !broken.has(url));
  const photo = gallery[Math.min(index, gallery.length - 1)] ?? null;
  const step = (delta: number) => setIndex((current) => (current + delta + gallery.length) % gallery.length);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ppsqft = listing.sqft ? Math.round((listing.price / listing.sqft) * 100) / 100 : null;
  const perBedroom = Math.round(pricePerBedroom(listing));
  const bedsLabel = listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bd`;
  const bathsLabel = listing.bathrooms === null ? '— ba' : `${listing.bathrooms} ba`;
  const sqftLabel = listing.sqft === null ? 'sqft n/a' : `${listing.sqft.toLocaleString()} sqft`;

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
        {photo ? (
          <>
            <img
              src={photo}
              alt=""
              loading="lazy"
              onClick={() => setExpanded(true)}
              className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
              onError={() => setBroken((current) => new Set(current).add(photo))}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.1))' }}
            />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full text-white text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  ‹
                </button>
                <button
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full text-white text-sm"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  ›
                </button>
                <span
                  className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-[10px] font-medium text-white/90"
                  style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                  Photo {Math.min(index, gallery.length - 1) + 1} of {gallery.length}
                </span>
              </>
            )}
            {expanded && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-6"
                style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
                onClick={() => setExpanded(false)}
                role="dialog"
                aria-label={`Photos of ${listing.title}`}
              >
                <img
                  src={photo}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  onClick={(event) => event.stopPropagation()}
                />
                {gallery.length > 1 && (
                  <>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        step(-1);
                      }}
                      aria-label="Previous photo"
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full text-white text-2xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        step(1);
                      }}
                      aria-label="Next photo"
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full text-white text-2xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                    >
                      ›
                    </button>
                  </>
                )}
                <span className="absolute bottom-6 text-xs text-white/80">
                  Photo {Math.min(index, gallery.length - 1) + 1} of {gallery.length} · click anywhere to close
                </span>
              </div>
            )}
          </>
        ) : (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-medium text-white/90" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
            {broken.size > 0 ? 'Photos failed to load' : `No photo from ${listing.sourceName}`}
          </span>
        )}
        {/* Shortlist heart, shared with the rest of the group */}
        <button
          onClick={() => void toggle(listing.id)}
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          aria-label={saved ? 'Remove from the shortlist' : 'Add to the shortlist'}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill={saved ? '#ef4444' : 'none'}
            stroke={saved ? '#ef4444' : 'white'}
            strokeWidth={2}
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>

        {/* Price and stats overlay */}
        <div className="relative z-10 pointer-events-none">
          <div className="text-2xl font-bold text-white">
            ${listing.price.toLocaleString()}<span className="text-sm font-normal opacity-80">/mo</span>
          </div>
          <div className="flex items-center gap-3 text-white/80 text-sm mt-1">
            <span>{bedsLabel}</span>
            <span className="opacity-50">|</span>
            <span>{bathsLabel}</span>
            <span className="opacity-50">|</span>
            <span>{sqftLabel}</span>
          </div>
        </div>

        {/* Neighborhood label */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-xs font-medium text-white/90 pointer-events-none"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          {listing.neighborhood}
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        <ScamBadge scam={listing.scam} />

        {/* Title */}
        <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--text)' }}>
          {listing.title}
        </h3>

        {/* Address */}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {listing.address}
        </p>

        <a
          href={googleMapsUrl(listing)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--accent)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          See the block on Google Maps
        </a>

        {commute.destination.trim() && (
          <a
            href={commuteUrl(listing, commute.destination, commute.time, commute.mode)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--accent)' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
            </svg>
            Directions to work, leaving {clockLabel(commute.time)}
          </a>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          <span>{bedsLabel} / {bathsLabel}</span>
          <span>{sqftLabel}</span>
          <span title="Rent split evenly by bedroom, so a big place shared by the group can beat a cheaper small one.">
            ${perBedroom.toLocaleString()}/bd
          </span>
          {ppsqft !== null && <span>${ppsqft.toFixed(2)}/sqft</span>}
          {listing.factsFrom && (
            <span
              title={`${listing.sourceName} did not publish these, so they come from ${listing.factsFrom}'s listing for the same building and unit size.`}
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--text-dim) 12%, transparent)',
                color: 'var(--text-dim)',
              }}
            >
              baths/sqft from {listing.factsFrom}
            </span>
          )}
        </div>

        {listing.area?.safety && (
          <div className="flex">
            <SafetyRating safety={listing.area.safety} />
          </div>
        )}

        {listing.lat !== null && listing.lng !== null && (
          <ListingMiniMap
            lat={listing.lat}
            lng={listing.lng}
            label={listing.address || listing.neighborhood}
            mapsUrl={googleMapsUrl(listing)}
          />
        )}

        <AreaFactsRow area={listing.area} />

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
