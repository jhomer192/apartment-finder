import { useEffect, useSyncExternalStore } from 'react';
import { bookTour, cancelTour, fetchTours } from '../api/client';
import type { TourDay } from '../api/types';

/**
 * Tour times are booked from a saved listing but read from the schedule panel,
 * so both share one copy of the plan the server worked out.
 */
let days: TourDay[] = [];
let started = false;
const listeners = new Set<() => void>();

function publish(next: TourDay[]) {
  days = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface Tours {
  days: TourDay[];
  book(tour: { listingKey: string; startsAt: number; minutes: number; note: string }): Promise<void>;
  cancel(id: number): Promise<void>;
}

export function useTours(): Tours {
  const value = useSyncExternalStore(subscribe, () => days);

  useEffect(() => {
    if (started) return;
    started = true;
    fetchTours()
      .then((data) => publish(data.days))
      .catch(() => {
        started = false;
      });
  }, []);

  return {
    days: value,
    book: async (tour) => publish((await bookTour(tour)).days),
    cancel: async (id) => publish((await cancelTour(id)).days),
  };
}
