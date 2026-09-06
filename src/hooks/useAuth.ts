import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { SessionUser } from '../api/types';

/** Invite links look like /invite/<token>; the token is consumed on first load. */
function inviteTokenFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]{10,200})$/);
  return match ? match[1] : null;
}

export function useAuth() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const inviteToken = inviteTokenFromUrl();
      try {
        if (inviteToken) {
          const redeemed = await api.redeemInvite(inviteToken);
          window.history.replaceState(null, '', '/');
          if (!cancelled) setUser(redeemed);
          return;
        }
        const session = await api.getSession();
        if (!cancelled) setUser(session);
      } catch (err) {
        if (cancelled) return;
        window.history.replaceState(null, '', '/');
        setError(err instanceof Error ? err.message : 'Could not sign you in.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setUser(await api.getSession());
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return { user, loading, error, signOut, refresh };
}
