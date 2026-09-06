import { createContext, useContext } from 'react';

export interface Dislikes {
  /** Distinct roommates who disliked each listing key. */
  counts: Record<string, number>;
  mine: Set<string>;
  hideAfter: number;
  error: string | null;
  /** True once enough roommates have voted the listing off the feed. */
  isHidden(listingKey: string): boolean;
  toggle(listingKey: string): Promise<void>;
}

export const DislikesContext = createContext<Dislikes | null>(null);

export function useDislikes(): Dislikes {
  const dislikes = useContext(DislikesContext);
  if (!dislikes) throw new Error('useDislikes must be used inside DislikesProvider');
  return dislikes;
}
