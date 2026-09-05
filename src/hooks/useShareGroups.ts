import { useEffect, useSyncExternalStore } from 'react';
import { deleteShareGroup, fetchShareGroups, saveShareGroup } from '../api/client';
import type { ShareGroup, StoredGroup } from '../api/types';

/**
 * Every listing card carries a Share button, so the group list is fetched once
 * for the page rather than once per card.
 */
let groups: StoredGroup[] = [];
let started = false;
const listeners = new Set<() => void>();

function publish(next: StoredGroup[]) {
  groups = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function refresh(): Promise<void> {
  publish((await fetchShareGroups()).groups);
}

export interface ShareGroups {
  groups: StoredGroup[];
  save(group: ShareGroup): Promise<void>;
  remove(id: number): Promise<void>;
  refresh(): Promise<void>;
}

export function useShareGroups(): ShareGroups {
  const value = useSyncExternalStore(subscribe, () => groups);

  useEffect(() => {
    if (started) return;
    started = true;
    void refresh().catch(() => {
      started = false;
    });
  }, []);

  return {
    groups: value,
    save: async (group) => {
      await saveShareGroup(group);
      await refresh();
    },
    remove: async (id) => {
      await deleteShareGroup(id);
      await refresh();
    },
    refresh,
  };
}
