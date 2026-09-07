import { useEffect, useState } from 'react';
import { ApiError, claimJoinLink, previewJoinLink } from '../api/client';

interface Props {
  token: string;
  onJoined: () => void;
  onDismiss: () => void;
}

const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

const MIN_PASSWORD_LENGTH = 6;

export function JoinGate({ token, onJoined, onDismiss }: Props) {
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewJoinLink(token)
      .then((preview) => {
        if (!cancelled) setInvitedBy(preview.invitedBy);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLinkError(err instanceof ApiError ? err.message : 'Could not check this invite link.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await claimJoinLink(token, email, password);
      onJoined();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not join. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="max-w-md w-full rounded-2xl border p-8 space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-bold text-center" style={{ color: 'var(--text)' }}>
          You&rsquo;re invited
        </h1>

        {linkError ? (
          <>
            <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              {linkError}
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--text-dim)' }}>
              Ask whoever sent it for a fresh link.
            </p>
            <button type="button" onClick={onDismiss} className="w-full text-xs underline" style={{ color: 'var(--text-dim)' }}>
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--text-dim)' }}>
              {invitedBy ? (
                <>
                  <strong style={{ color: 'var(--text)' }}>{invitedBy}</strong> invited you to the roommate group&rsquo;s
                  apartment finder. Pick the email and password you&rsquo;ll sign in with.
                </>
              ) : (
                'Checking your invite link…'
              )}
            </p>
            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`Choose a password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                autoComplete="new-password"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={busy || invitedBy === null}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                {busy ? 'Joining…' : 'Join the group'}
              </button>
            </form>
            <button type="button" onClick={onDismiss} className="w-full text-xs underline" style={{ color: 'var(--text-dim)' }}>
              Already a member? Sign in instead
            </button>
          </>
        )}

        {formError && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
            {formError}
          </p>
        )}
      </div>
    </div>
  );
}
