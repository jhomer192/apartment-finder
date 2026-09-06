import { useState } from 'react';
import { draftContactMessage } from '../api/client';
import type { ContactDraft as Draft, SavedListing } from '../api/types';

interface Props {
  entry: SavedListing;
}

function mailtoLink(draft: Draft): string | null {
  if (!draft.email) return null;
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  return `mailto:${draft.email}?${params.toString()}`;
}

/** Drafts a message for the group to send; nothing is sent from the server. */
export function ContactDraft({ entry }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ask, setAsk] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setDraft(await draftContactMessage(entry.key, ask));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not draft a message');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const phone = entry.listing.contactPhone;
  const mailto = draft ? mailtoLink(draft) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ask}
          onChange={(event) => setAsk(event.target.value)}
          placeholder="Anything to add? e.g. move-in Nov 1, five tenants"
          maxLength={500}
          className="flex-1 min-w-[12rem] text-xs px-2.5 py-1.5 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          {loading ? 'Drafting…' : 'Draft message'}
        </button>
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            Call {phone}
          </a>
        )}
        <a
          href={entry.listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          Open listing
        </a>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {draft && (
        <div
          className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {draft.subject}
          </p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
            {draft.body}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void copy()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            {mailto && (
              <a
                href={mailto}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Email {draft.email}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
