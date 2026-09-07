import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  onSignOut: () => void;
  children: ReactNode;
}

/**
 * Right-hand slide-over holding everything that is not browsing: house rules,
 * saved searches, commute, alerts, refresh, password and theme. Keeping them
 * here leaves the main page for listings, the way a marketplace does.
 */
export function SettingsDrawer({ open, onClose, email, onSignOut, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Settings">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 w-full h-full"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      />
      <aside
        className="relative h-full w-full max-w-lg overflow-y-auto shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              Your group
            </h2>
            <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>
              Signed in as {email}
            </p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="ml-auto pill"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ color: 'var(--text)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </aside>
    </div>
  );
}

/** A labelled block inside the drawer. */
export function DrawerSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h3>
        {hint && (
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
