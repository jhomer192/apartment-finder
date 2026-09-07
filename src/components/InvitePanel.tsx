import { useEffect, useState } from 'react';
import { ApiError, createJoinLink, fetchJoinLinks, removeMember, revokeJoinLink } from '../api/client';
import type { JoinLink, Member } from '../api/types';
import { canShareNatively, copyText, shareNatively, smsHref } from '../utils/share';

interface Props {
  email: string;
  isAdmin: boolean;
}

const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

function inviteText(url: string, from: string): string {
  return `${from} invited you to our apartment finder — open this link, pick a password and you're in (link works once, expires in 7 days): ${url}`;
}

function daysLeft(expiresAt: number): string {
  const days = Math.min(7, Math.ceil((expiresAt - Date.now()) / 86_400_000));
  return days <= 0 ? 'expired' : days === 1 ? 'expires tomorrow' : `expires in ${days} days`;
}

/**
 * The server never texts anyone: the link is minted here and handed to the
 * phone's share sheet / Messages so the sender's own number does the inviting.
 */
export function InvitePanel({ email, isAdmin }: Props) {
  const [links, setLinks] = useState<JoinLink[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [label, setLabel] = useState('');
  const [fresh, setFresh] = useState<{ url: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJoinLinks()
      .then((data) => {
        setLinks(data.links);
        setMembers(data.members);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load invites.'));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await createJoinLink(label.trim());
      setLinks(result.links);
      setFresh({ url: result.url, id: result.link.id });
      setLabel('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create an invite link.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    try {
      const result = await revokeJoinLink(id);
      setLinks(result.links);
      if (fresh?.id === id) setFresh(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke that link.');
    }
  }

  async function remove(target: string) {
    if (!window.confirm(`Remove ${target} from the group? They will be signed out everywhere.`)) return;
    try {
      const result = await removeMember(target);
      setMembers(result.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that member.');
    }
  }

  const text = fresh ? inviteText(fresh.url, email) : '';
  const open = links.filter((link) => link.claimedAt === null);

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          placeholder="Who's it for? (optional, e.g. Sam)"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {busy ? 'Creating…' : 'Create invite link'}
        </button>
      </form>

      {fresh && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--surface)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            Send this to your friend — it works once and expires in 7 days.
          </p>
          <input
            readOnly
            value={fresh.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border px-3 py-2 text-xs font-mono outline-none"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-2">
            {canShareNatively() && (
              <button
                type="button"
                onClick={() => void shareNatively('Apartment finder invite', text)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                Share…
              </button>
            )}
            <a
              href={smsHref(text)}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              Text it
            </a>
            <button
              type="button"
              onClick={async () => setCopied(await copyText(fresh.url))}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-dim)' }}>
            Unused links
          </p>
          <ul className="space-y-1">
            {open.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text)' }}>
                <span className="min-w-0 break-words">
                  {link.label || 'Invite'} · from {link.createdBy} · {daysLeft(link.expiresAt)}
                </span>
                <button type="button" onClick={() => void revoke(link.id)} className="font-semibold shrink-0" style={{ color: '#ef4444' }}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-dim)' }}>
          Members ({members.length})
        </p>
        <ul className="space-y-1">
          {members.map((member) => (
            <li key={member.email} className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text)' }}>
              <span className="min-w-0 break-words">
                {member.email}
                {member.isAdmin && <span style={{ color: 'var(--text-dim)' }}> · owner</span>}
                {member.invitedBy && <span style={{ color: 'var(--text-dim)' }}> · invited by {member.invitedBy}</span>}
              </span>
              {isAdmin && member.removable && (
                <button type="button" onClick={() => void remove(member.email)} className="font-semibold shrink-0" style={{ color: '#ef4444' }}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  );
}
