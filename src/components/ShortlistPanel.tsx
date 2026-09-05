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

export function ShortlistPanel() {
  const { saved, error, toggle, setStatus } = useShortlist();
  const [open, setOpen] = useState(false);

  if (saved.length === 0 && !error) return null;

  return (
    <section
      className="rounded-xl border"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen((value) => !value)}
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

      {open && (
        <div className="px-4 pb-4 space-y-4">
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
                  className="text-xs px-2 py-1 rounded-lg border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
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
