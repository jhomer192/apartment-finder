import { createContext, useContext } from 'react';
import type { SavedListing, SavedStatus } from '../api/types';

export interface Shortlist {
  saved: SavedListing[];
  keys: Set<string>;
  error: string | null;
  toggle(listingKey: string): Promise<void>;
  setStatus(listingKey: string, status: SavedStatus): Promise<void>;
  addNote(listingKey: string, body: string): Promise<void>;
}

export const ShortlistContext = createContext<Shortlist | null>(null);

export function useShortlist(): Shortlist {
  const shortlist = useContext(ShortlistContext);
  if (!shortlist) throw new Error('useShortlist must be used inside ShortlistProvider');
  return shortlist;
}
