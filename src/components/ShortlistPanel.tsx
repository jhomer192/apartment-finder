import { useState } from 'react';
import { SAVED_STATUSES, type SavedListing } from '../api/types';
import { useShortlist } from '../hooks/useShortlist';
import { ContactDraft } from './ContactDraft';

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

interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortlistPanel({ open, onOpenChange }: PanelProps) {
  const { saved, error, toggle, setStatus, removeAll } = useShortlist();
  const [confirmingRemoveAll, setConfirmingRemoveAll] = useState(false);

  if (saved.length === 0 && !error && !open) return null;

  return (
    <section
      id="shortlist"
      className="rounded-xl border"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Shortlist
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {saved.length} saved by the group
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {error && (
        <p className="px-4 pb-3 text-xs text-red-400">{error}</p>
      )}

      {open && saved.length === 0 && (
        <p className="px-4 pb-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          Nothing saved yet. Tap the heart on a listing and it shows up here for everyone.
        </p>
      )}

      {open && saved.length > 0 && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex justify-end">
            {confirmingRemoveAll ? (
              <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                Remove all {saved.length}?
                <button
                  onClick={() => {
                    setConfirmingRemoveAll(false);
                    void removeAll();
                  }}
                  className="font-semibold px-2 py-1 rounded-lg"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  Remove
                </button>
                <button
                  onClick={() => setConfirmingRemoveAll(false)}
                  className="px-2 py-1 rounded-lg border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingRemoveAll(true)}
                className="text-xs px-2 py-1 rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
              >
                Remove all
              </button>
            )}
          </div>

          {saved.map((entry) => (
            <div
              key={entry.key}
              className="rounded-lg border p-3 space-y-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  {entry.listing.title}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  ${entry.listing.price.toLocaleString()}/mo · {entry.listing.neighborhood} · scam
                  risk {entry.listing.scam.score}/100
                </span>
                <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>
                  saved by {shortName(entry.savedBy)}
                </span>
                <button
                  onClick={() => void toggle(entry.key)}
                  aria-label={`Remove ${entry.listing.title} from the shortlist`}
                  className="text-xs px-2 py-1 rounded-lg border font-medium"
                  style={{ borderColor: 'color-mix(in srgb, #ef4444 45%, transparent)', color: '#ef4444' }}
                >
                  Remove
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
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
              </div>

              <ContactDraft entry={entry} />
              <NoteList entry={entry} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
