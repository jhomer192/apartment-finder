import { useState } from 'react';
import { SAVED_STATUSES, type SavedListing } from '../api/types';
import { useShortlist } from '../hooks/useShortlist';
import { useTours } from '../hooks/useTours';
import { googleMapsUrl } from '../utils/maps';
import { toEpoch, tourDayLabel, tourTime, toursFor } from '../utils/tours';
import { ContactDraft } from './ContactDraft';
import { ScamBadge } from './ScamBadge';
import { ShareButton } from './ShareButton';

const STATUS_COLORS: Record<string, string> = {
  saved: '#64748b',
  contacted: '#0ea5e9',
  touring: '#8b5cf6',
  applied: '#22c55e',
  passed: '#ef4444',
};

function shortName(email: string): string {
  return email.split('@')[0];
}

function NoteList({ entry }: { entry: SavedListing }) {
  const { addNote } = useShortlist();
  const [body, setBody] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody('');
    await addNote(entry.key, text);
  }

  return (
    <div className="space-y-2">
      {entry.notes.map((note) => (
        <p key={note.id} className="text-xs" style={{ color: 'var(--text-dim)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            {shortName(note.email)}:
          </span>{' '}
          {note.body}
        </p>
      ))}
      <form onSubmit={(event) => void submit(event)} className="flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a note for the group"
          maxLength={2000}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          type="submit"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Post
        </button>
      </form>
    </div>
  );
}

function TourRow({ entry }: { entry: SavedListing }) {
  const { days, book, cancel } = useTours();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const booked = toursFor(days, entry.key);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const startsAt = toEpoch(date, time);
    if (startsAt === null) {
      setError('Pick a date and a time.');
      return;
    }
    try {
      await book({ listingKey: entry.key, startsAt, minutes, note: '' });
      setDate('');
      setTime('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that tour');
    }
  }

  return (
    <div className="space-y-1.5">
      {booked.map((tour) => (
        <p key={tour.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          <span style={{ color: '#8b5cf6' }}>Tour</span>
          <span style={{ color: 'var(--text)' }}>
            {tourDayLabel(new Date(tour.startsAt).toLocaleDateString('en-CA'))} at {tourTime(tour.startsAt)}
          </span>
          <span>· {tour.minutes} min</span>
          <button
            onClick={() => void cancel(tour.id)}
            className="underline"
            style={{ color: '#ef4444' }}
          >
            cancel
          </button>
        </p>
      ))}

      <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label={`Tour date for ${entry.listing.title}`}
          className="text-xs px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-label={`Tour time for ${entry.listing.title}`}
          className="text-xs px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <select
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
          aria-label={`Tour length for ${entry.listing.title}`}
          className="text-xs px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {[15, 30, 45, 60].map((length) => (
            <option key={length} value={length}>
              {length} min
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Add tour
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
    </div>
  );
}

interface Props {
  entry: SavedListing;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}

/**
 * The shortlist card mirrors the listing cards above — photo, price, scam badge
 * — so a saved place is recognisable, with the group's own notes, statuses and
 * tour times underneath.
 */
export function SavedListingCard({ entry, selected, onSelect }: Props) {
  const { toggle, setStatus } = useShortlist();
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const listing = entry.listing;

  const photos = listing.imageUrls ?? [];
  const gallery = (photos.length > 0 ? photos : listing.imageUrl ? [listing.imageUrl] : [])
    .filter((url) => !broken.has(url));
  const photo = gallery[0] ?? null;

  const beds = listing.bedrooms === 0 ? 'Studio' : listing.bedrooms === null ? '— bd' : `${listing.bedrooms} bd`;
  const baths = listing.bathrooms === null ? '— ba' : `${listing.bathrooms} ba`;
  const perBedroom = Math.round(listing.price / Math.max(1, listing.bedrooms ?? 1));

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative sm:w-48 h-32 sm:h-auto shrink-0" style={{ backgroundColor: 'var(--border)' }}>
          {photo ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setBroken((current) => new Set(current).add(photo))}
            />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center text-[11px] text-center px-2"
              style={{ color: 'var(--text-dim)' }}
            >
              No photo from {listing.sourceName}
            </span>
          )}
          <label
            className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white cursor-pointer"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect(event.target.checked)}
              aria-label={`Select ${listing.title} to share`}
            />
            Select
          </label>
        </div>

        <div className="flex-1 p-3 space-y-2 min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                {listing.title}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                ${listing.price.toLocaleString()}/mo · ${perBedroom.toLocaleString()}/bd · {beds} · {baths} ·{' '}
                {listing.neighborhood}
              </p>
              {listing.address && (
                <a
                  href={googleMapsUrl(listing)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {listing.address}
                </a>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <ShareButton listings={[listing]} compact />
              <button
                onClick={() => void toggle(entry.key)}
                aria-label={`Remove ${listing.title} from the shortlist`}
                className="text-xs px-2 py-1 rounded-lg border font-medium"
                style={{ borderColor: 'color-mix(in srgb, #ef4444 45%, transparent)', color: '#ef4444' }}
              >
                Remove
              </button>
            </div>
          </div>

          <ScamBadge scam={listing.scam} />

          <div className="flex flex-wrap items-center gap-1.5">
            {SAVED_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => void setStatus(entry.key, status)}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium border capitalize"
                style={
                  entry.status === status
                    ? { backgroundColor: STATUS_COLORS[status], borderColor: STATUS_COLORS[status], color: '#fff' }
                    : { borderColor: 'var(--border)', color: 'var(--text-dim)' }
                }
              >
                {status}
              </button>
            ))}
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs underline"
              style={{ color: 'var(--accent)' }}
            >
              {listing.sourceName}
            </a>
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              saved by {shortName(entry.savedBy)}
            </span>
          </div>

          <TourRow entry={entry} />
          <ContactDraft entry={entry} />
          <NoteList entry={entry} />
        </div>
      </div>
    </div>
  );
}
