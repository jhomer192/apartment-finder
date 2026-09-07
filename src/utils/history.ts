import type { ListingHistory } from '../api/types';

const DAY = 86_400_000;

/** Days since the earlier of the source's posted date and our first crawl. */
export function daysOnMarket(history: ListingHistory | undefined, postedAt: number | null, now = Date.now()): number | null {
  const candidates = [history?.firstSeenAt, postedAt].filter((v): v is number => typeof v === 'number' && v > 0);
  if (candidates.length === 0) return null;
  return Math.max(0, Math.floor((now - Math.min(...candidates)) / DAY));
}

/** The last rent before the current one, when the crawl has seen a change. */
export function previousPrice(history: ListingHistory | undefined, price: number): number | null {
  if (!history || history.prices.length < 2) return null;
  const earlier = [...history.prices].reverse().find((point) => point.price !== price);
  return earlier ? earlier.price : null;
}
