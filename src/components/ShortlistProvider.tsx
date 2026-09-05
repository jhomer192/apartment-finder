import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  addSavedNote,
  fetchSaved,
  saveListing,
  setSavedStatus,
  unsaveListing,
} from '../api/client';
import type { SavedListing, SavedStatus } from '../api/types';
import { ShortlistContext, type Shortlist } from '../hooks/useShortlist';

/**
 * The shortlist is shared by the whole group, so it lives on the server rather
 * than in one roommate's browser.
 */
export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchSaved()
      .then((data) => {
        if (live) setSaved(data.saved);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'Could not load the shortlist');
      });
    return () => {
      live = false;
    };
  }, []);

  const replace = useCallback((entry: SavedListing) => {
    setSaved((current) => {
      const rest = current.filter((item) => item.key !== entry.key);
      return [entry, ...rest].sort((a, b) => b.savedAt - a.savedAt);
    });
  }, []);

  const run = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work');
    }
  }, []);

  const value = useMemo<Shortlist>(() => {
    const keys = new Set(saved.map((entry) => entry.key));
    return {
      saved,
      keys,
      error,
      toggle: (listingKey) =>
        run(async () => {
          if (keys.has(listingKey)) {
            await unsaveListing(listingKey);
            setSaved((current) => current.filter((entry) => entry.key !== listingKey));
          } else {
            replace((await saveListing(listingKey)).saved);
          }
        }),
      setStatus: (listingKey, status: SavedStatus) =>
        run(async () => {
          replace((await setSavedStatus(listingKey, status)).saved);
        }),
      addNote: (listingKey, body) =>
        run(async () => {
          const { note } = await addSavedNote(listingKey, body);
          setSaved((current) =>
            current.map((entry) =>
              entry.key === listingKey ? { ...entry, notes: [...entry.notes, note] } : entry,
            ),
          );
        }),
    };
  }, [saved, error, replace, run]);

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}
