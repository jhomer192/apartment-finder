import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dislikeListing, fetchDislikes, undislikeListing } from '../api/client';
import type { DislikeSummary } from '../api/types';
import { DislikesContext, type Dislikes } from '../hooks/useDislikes';

const EMPTY: DislikeSummary = { counts: {}, mine: [], hideAfter: 3 };

/**
 * Dislikes are votes, not a personal mute: one roommate's thumbs-down shows as
 * a count on the card, and the listing only disappears once enough of the
 * group agree. Kept on the server so every browser sees the same tally.
 */
export function DislikesProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<DislikeSummary>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchDislikes()
      .then((data) => {
        if (live) setSummary(data);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load dislikes');
      });
    return () => {
      live = false;
    };
  }, []);

  const toggle = useCallback(
    async (listingKey: string) => {
      try {
        const next = summary.mine.includes(listingKey)
          ? await undislikeListing(listingKey)
          : await dislikeListing(listingKey);
        setSummary(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That did not work');
      }
    },
    [summary.mine],
  );

  const value = useMemo<Dislikes>(
    () => ({
      counts: summary.counts,
      mine: new Set(summary.mine),
      hideAfter: summary.hideAfter,
      error,
      isHidden: (listingKey) => (summary.counts[listingKey] ?? 0) >= summary.hideAfter,
      toggle,
    }),
    [summary, error, toggle],
  );

  return <DislikesContext.Provider value={value}>{children}</DislikesContext.Provider>;
}
