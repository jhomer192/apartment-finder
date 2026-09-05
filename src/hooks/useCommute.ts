import { useCallback, useSyncExternalStore } from 'react';
import type { CommuteMode } from '../utils/maps';

export interface Commute {
  destination: string;
  time: string;
  mode: CommuteMode;
}

const STORAGE_KEY = 'apartment-finder.commute';
const EMPTY: Commute = { destination: '', time: '08:00', mode: 'transit' };

function read(): Commute {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return EMPTY;
    const parsed = JSON.parse(stored) as Partial<Commute>;
    return {
      destination: typeof parsed.destination === 'string' ? parsed.destination : '',
      time: typeof parsed.time === 'string' ? parsed.time : EMPTY.time,
      mode: parsed.mode === 'drive' ? 'drive' : 'transit',
    };
  } catch {
    return EMPTY;
  }
}

// Every card reads the commute, so it lives in one store rather than a copy per
// component that would drift the moment the settings change.
let current: Commute = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function snapshot(): Commute {
  if (!loaded) {
    current = read();
    loaded = true;
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Where you commute to is a personal preference, so it stays in the browser. */
export function useCommute(): { commute: Commute; save: (next: Commute) => void } {
  const commute = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  const save = useCallback((next: Commute) => {
    current = next;
    loaded = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A browser refusing storage just means the setting lasts one session.
    }
    for (const listener of listeners) listener();
  }, []);

  return { commute, save };
}
