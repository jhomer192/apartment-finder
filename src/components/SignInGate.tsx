import { useState } from 'react';
import { ApiError, requestSignInLink } from '../api/client';

interface Props {
  error: string | null;
}

export function SignInGate({ error }: Props) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setFormError(null);
    try {
      await requestSignInLink(email);
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Could not send the link. Try again shortly.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="max-w-md w-full rounded-2xl border p-8 space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-bold text-center" style={{ color: 'var(--text)' }}>
          Invite only
        </h1>

        {sent ? (
          <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--text-dim)' }}>
            If <strong style={{ color: 'var(--text)' }}>{email}</strong> is on the list, a sign-in
            link is on its way. It works once and expires.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--text-dim)' }}>
              This apartment finder is private to one roommate group. Enter your email and we'll
              send you a sign-in link.
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
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                {sending ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          </>
        )}

        {(error ?? formError) && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          >
            {error ?? formError}
          </p>
        )}
      </div>
    </div>
  );
}
