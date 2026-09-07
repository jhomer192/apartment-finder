import { useEffect, useState } from 'react';
import type { Listing } from '../types';
import { useShortlist } from '../hooks/useShortlist';
import { useDislikes } from '../hooks/useDislikes';
import { ScamBadge } from './ScamBadge';
import { useCommute } from '../hooks/useCommute';
import { clockLabel, commuteUrl, googleMapsUrl } from '../utils/maps';
import { AreaFactsRow } from './AreaFactsRow';
import { pricePerBedroom } from '../utils/rooms';
import { ListingMiniMap } from './ListingMiniMap';
import { SafetyRating } from './SafetyRating';
import { ShareButton } from './ShareButton';

interface Props {
  listing: Listing;
}

export function ListingCard({ listing }: Props) {
  const { keys, toggle } = useShortlist();
  const dislikes = useDislikes();
  const { commute } = useCommute();
  const disliked = dislikes.mine.has(listing.id);
  const dislikeCount = dislikes.counts[listing.id] ?? 0;
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(false);
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

  const overlayButton = 'flex items-center justify-center rounded-full transition-colors backdrop-blur-sm';

  return (
    <article className="card card-hover overflow-hidden flex flex-col">
      {/* Photo */}
      <div
        className="relative aspect-[4/3] group"
        style={{ background: `linear-gradient(135deg, ${listing.gradientFrom}, ${listing.gradientTo})` }}
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
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                  className={`${overlayButton} absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 text-lg opacity-0 group-hover:opacity-100 focus:opacity-100`}
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#1f1f23' }}
                >
                  ‹
                </button>
                <button
                  onClick={() => step(1)}
                  aria-label="Next photo"
                  className={`${overlayButton} absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 text-lg opacity-0 group-hover:opacity-100 focus:opacity-100`}
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#1f1f23' }}
                >
                  ›
                </button>
                <span
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
                >
                  {Math.min(index, gallery.length - 1) + 1} / {gallery.length}
                </span>
              </>
            )}
            {expanded && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-6"
                style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
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
          <span
            className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {broken.size > 0 ? 'Photos failed to load' : `No photo from ${listing.sourceName}`}
          </span>
        )}

        <span
          className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#1f1f23' }}
        >
          {listing.neighborhood}
        </span>

        {/* Thumbs-down: a vote, shared with the group, that hides the listing once enough agree */}
        <button
          onClick={() => void dislikes.toggle(listing.id)}
          className={`${overlayButton} absolute top-3 right-14 z-10 h-9 px-2.5 gap-1 text-xs font-semibold`}
          style={{
            backgroundColor: disliked ? '#ef4444' : 'rgba(255,255,255,0.92)',
            color: disliked ? '#fff' : '#1f1f23',
          }}
          aria-pressed={disliked}
          aria-label={disliked ? 'Take back your dislike' : 'Dislike this listing'}
          title={`${dislikeCount} of ${dislikes.hideAfter} dislikes needed to hide it from everyone's feed`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14V2M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22a3.13 3.13 0 01-3-3.88z" />
          </svg>
          {dislikeCount > 0 && <span>{dislikeCount}</span>}
        </button>
        {/* Shortlist heart, shared with the rest of the group */}
        <button
          onClick={() => void toggle(listing.id)}
          className={`${overlayButton} absolute top-3 right-3 z-10 w-9 h-9`}
          style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
          aria-label={saved ? 'Remove from the shortlist' : 'Add to the shortlist'}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : '#1f1f23'} strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </button>
      </div>

      {/* Summary */}
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
            ${listing.price.toLocaleString()}
            <span className="text-sm font-normal" style={{ color: 'var(--text-dim)' }}>
              /mo
            </span>
          </p>
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            ${perBedroom.toLocaleString()}/bd
          </span>
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {bedsLabel}
          <span className="font-normal" style={{ color: 'var(--text-dim)' }}> · </span>
          {bathsLabel}
          {listing.sqft !== null && (
            <>
              <span className="font-normal" style={{ color: 'var(--text-dim)' }}> · </span>
              {sqftLabel}
            </>
          )}
        </p>

        <p className="text-sm truncate" style={{ color: 'var(--text-dim)' }} title={listing.address}>
          {listing.address || listing.title}
        </p>

        <ScamBadge scam={listing.scam} />

        <div className="flex flex-wrap items-center gap-2">
          {listing.area?.safety && <SafetyRating safety={listing.area.safety} />}
          {listing.factsFrom && (
            <span
              title={`${listing.sourceName} did not publish these, so they come from ${listing.factsFrom}'s listing for the same building and unit size.`}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              baths/sqft from {listing.factsFrom}
            </span>
          )}
          {listing.amenities.slice(0, 3).map((a) => (
            <span
              key={a}
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
            >
              {a}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDetails((current) => !current)}
          aria-expanded={details}
          className="self-start text-sm font-semibold underline underline-offset-2"
          style={{ color: 'var(--text)' }}
        >
          {details ? 'Hide details' : 'Details & map'}
        </button>

        {details && (
          <div className="space-y-3 pt-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {listing.title}
            </p>

            {listing.lat !== null && listing.lng !== null && (
              <ListingMiniMap
                lat={listing.lat}
                lng={listing.lng}
                label={listing.address || listing.neighborhood}
                mapsUrl={googleMapsUrl(listing)}
              />
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1">
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
                  className="inline-flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                  </svg>
                  Directions to work, leaving {clockLabel(commute.time)}
                </a>
              )}
            </div>

            <AreaFactsRow area={listing.area} />

            {(ppsqft !== null || listing.amenities.length > 3) && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
                {ppsqft !== null && <span className="mr-2">${ppsqft.toFixed(2)}/sqft</span>}
                {listing.amenities.slice(3).map((a) => (
                  <span
                    key={a}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Source + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0 text-xs" style={{ color: 'var(--text-dim)' }}>
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-[10px] shrink-0"
              style={{ backgroundColor: listing.sourceColor }}
            >
              {listing.sourceName[0]}
            </span>
            <span className="truncate">
              {listing.sourceName}
              {listing.alsoOn.length > 0 && (
                <>
                  {' · also on '}
                  {listing.alsoOn.map((other, position) => (
                    <a
                      key={other.sourceId}
                      href={other.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {position > 0 ? ', ' : ''}
                      {other.sourceName}
                    </a>
                  ))}
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareButton listings={[listing]} compact />
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              View listing
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
