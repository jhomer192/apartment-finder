import { useState } from 'react';
import { draftContactMessage } from '../api/client';
import {
  CONTACT_OUTCOMES,
  type ContactChannel,
  type ContactDraft as Draft,
  type ContactEntry,
  type ContactOutcome,
} from '../api/types';
import { useContacts } from '../hooks/useContacts';

interface Props {
  listingKey: string;
  url: string;
  contactPhone: string | null;
  contactEmail: string | null;
}

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  email: 'emailed',
  sms: 'texted',
  call: 'called',
  site: 'messaged on the site',
};

const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  sent: 'waiting on a reply',
  replied: 'replied',
  'tour-offered': 'tour offered',
  declined: 'declined',
  'no-reply': 'no reply',
};

function mailtoLink(draft: Draft): string | null {
  if (!draft.email) return null;
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  return `mailto:${draft.email}?${params.toString()}`;
}

function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function smsLink(phone: string, body: string | null): string {
  return body ? `sms:${digits(phone)}?&body=${encodeURIComponent(body)}` : `sms:${digits(phone)}`;
}

function firstName(email: string): string {
  return email.split('@')[0];
}

function daysAgo(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** One line per roommate who reached out: who, how, when, and what came back. */
export function ContactLog({ listingKey }: { listingKey: string }) {
  const contacts = useContacts();
  const entries = contacts.byListing.get(listingKey) ?? [];
  if (entries.length === 0) return null;

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => (
        <ContactLogRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

function ContactLogRow({ entry }: { entry: ContactEntry }) {
  const contacts = useContacts();
  const waiting = entry.outcome === 'sent';
  return (
    <li
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs rounded-lg px-2.5 py-1.5"
      style={{
        backgroundColor: waiting ? 'rgba(245,158,11,0.12)' : 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <span>
        <strong>{firstName(entry.email)}</strong> {CHANNEL_LABEL[entry.via]} the lister {daysAgo(entry.contactedAt)}
        {entry.note && <span style={{ color: 'var(--text-dim)' }}> · {entry.note}</span>}
      </span>
      <select
        value={entry.outcome}
        onChange={(event) => void contacts.update(entry.id, { outcome: event.target.value as ContactOutcome })}
        aria-label="What came back"
        className="ml-auto text-xs rounded-md border bg-transparent px-1.5 py-0.5"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        {CONTACT_OUTCOMES.map((outcome) => (
          <option key={outcome} value={outcome}>
            {OUTCOME_LABEL[outcome]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void contacts.remove(entry.id)}
        className="text-[11px] underline"
        style={{ color: 'var(--text-dim)' }}
        title="Logged by mistake"
      >
        undo
      </button>
    </li>
  );
}

/**
 * Drafts a message for the group to send; nothing is sent from the server.
 * Whoever hands off to their mail or SMS app is asked to log it so the rest of
 * the group can see the lister has already been reached.
 */
export function ContactDraft({ listingKey, url, contactPhone, contactEmail }: Props) {
  const contacts = useContacts();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ask, setAsk] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<ContactChannel | null>(null);
  const [note, setNote] = useState('');

  const existing = contacts.byListing.get(listingKey) ?? [];

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setDraft(await draftContactMessage(listingKey, ask));
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

  async function confirmLog() {
    if (!pending) return;
    await contacts.log(listingKey, pending, note);
    setPending(null);
    setNote('');
  }

  const mailto = draft ? mailtoLink(draft) : contactEmail ? `mailto:${contactEmail}` : null;
  const linkStyle = { borderColor: 'var(--border)', color: 'var(--text)' };
  const handoff = (channel: ContactChannel) => () => setPending(channel);

  return (
    <div className="space-y-2">
      {existing.length > 0 && (
        <p className="text-xs font-semibold" style={{ color: '#b45309' }}>
          Already contacted by {[...new Set(existing.map((entry) => firstName(entry.email)))].join(', ')} — check
          the log before reaching out again.
        </p>
      )}
      <ContactLog listingKey={listingKey} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ask}
          onChange={(event) => setAsk(event.target.value)}
          placeholder="Anything to add? e.g. move-in Nov 1, five tenants"
          maxLength={500}
          className="flex-1 min-w-[12rem] text-xs px-2.5 py-1.5 rounded-lg border bg-transparent"
          style={linkStyle}
        />
        <button
          onClick={() => void generate()}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50"
          style={linkStyle}
        >
          {loading ? 'Drafting…' : draft ? 'Redraft' : 'Draft message with Claude'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {draft && (
        <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {draft.subject}
          </p>
          <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-dim)' }}>
            {draft.body}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {draft && (
          <button onClick={() => void copy()} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={linkStyle}>
            {copied ? 'Copied' : 'Copy draft'}
          </button>
        )}
        {mailto && (
          <a href={mailto} onClick={handoff('email')} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={linkStyle}>
            Email {contactEmail ?? draft?.email}
          </a>
        )}
        {contactPhone && (
          <>
            <a
              href={smsLink(contactPhone, draft?.body ?? null)}
              onClick={handoff('sms')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
              style={linkStyle}
            >
              Text {contactPhone}
            </a>
            <a href={`tel:${digits(contactPhone)}`} onClick={handoff('call')} className="text-xs font-semibold px-3 py-1.5 rounded-lg border" style={linkStyle}>
              Call
            </a>
          </>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handoff('site')}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          Message on the site
        </a>
        {!pending && (
          <button
            type="button"
            onClick={() => setPending('email')}
            className="text-xs underline"
            style={{ color: 'var(--text-dim)' }}
          >
            Log a contact I already made
          </button>
        )}
      </div>

      {pending && (
        <div
          className="rounded-lg border p-2.5 flex flex-wrap items-center gap-2 text-xs"
          style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
        >
          <span>Did you reach out? Log it so nobody else double-contacts them:</span>
          <select
            value={pending}
            onChange={(event) => setPending(event.target.value as ContactChannel)}
            aria-label="How you reached out"
            className="rounded-md border bg-transparent px-1.5 py-1"
            style={linkStyle}
          >
            <option value="email">by email</option>
            <option value="sms">by text</option>
            <option value="call">by phone</option>
            <option value="site">on the site</option>
          </select>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="optional note, e.g. asked for Sat tour"
            maxLength={500}
            className="flex-1 min-w-[10rem] px-2 py-1 rounded-md border bg-transparent"
            style={linkStyle}
          />
          <button
            type="button"
            onClick={() => void confirmLog()}
            className="font-semibold px-3 py-1 rounded-md text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Yes, log it
          </button>
          <button type="button" onClick={() => setPending(null)} className="underline" style={{ color: 'var(--text-dim)' }}>
            No
          </button>
        </div>
      )}
      {contacts.error && <p className="text-xs text-red-400">{contacts.error}</p>}
    </div>
  );
}
