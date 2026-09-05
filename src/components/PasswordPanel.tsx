import { useState } from 'react';
import { ApiError, setPassword } from '../api/client';

const MIN_LENGTH = 12;

interface Props {
  hasPassword: boolean;
  onPasswordSet: () => void;
}

export function PasswordPanel({ hasPassword, onPasswordSet }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await setPassword(password);
      setValue('');
      setMessage('Saved. You can sign in with this password from now on.');
      onPasswordSet();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Password
          </p>
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {hasPassword
              ? 'Set · you can sign in without waiting for an email'
              : 'Not set · you sign in by email link'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-xs font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          {open ? 'Close' : hasPassword ? 'Change' : 'Set one'}
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            required
            minLength={MIN_LENGTH}
            value={password}
            onChange={(event) => setValue(event.target.value)}
            placeholder={`At least ${MIN_LENGTH} characters`}
            autoComplete="new-password"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}

      {message && (
        <p className="mt-2 text-xs" style={{ color: '#22c55e' }}>
          {message}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  );
}
