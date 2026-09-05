interface Props {
  error: string | null;
}

export function SignInGate({ error }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div
        className="max-w-md w-full rounded-2xl border p-8 text-center space-y-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Invite only
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          This apartment finder is private to one roommate group. Open the invite link you were
          sent to sign in — it works once and expires.
        </p>
        {error && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          >
            {error}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Need a new link? Ask the group admin to generate one.
        </p>
      </div>
    </div>
  );
}
