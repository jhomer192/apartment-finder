import type { Availability, ListingHistory } from '../api/types';
import { daysOnMarket, previousPrice } from '../utils/history';

function pill(background: string, color: string) {
  return { backgroundColor: background, color };
}

interface Props {
  history: ListingHistory | undefined;
  price: number;
  postedAt: number | null;
  /** Only saved listings carry this; live results are by definition still listed. */
  availability?: Availability;
}

/** Small chips: price cut or hike, how long it has sat, and whether it has vanished. */
export function HistoryBadges({ history, price, postedAt, availability }: Props) {
  const was = previousPrice(history, price);
  const days = daysOnMarket(history, postedAt);
  const gone = availability?.status === 'gone';

  const chips: Array<{ key: string; label: string; title: string; style: React.CSSProperties }> = [];

  if (gone) {
    chips.push({
      key: 'gone',
      label: availability.lastSeenAt
        ? `No longer listed · last seen ${new Date(availability.lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : 'No longer listed',
      title: 'The source stopped returning this listing. Rented, withdrawn — or, if it comes back cheaper, a scam tell.',
      style: pill('rgba(107,114,128,0.15)', 'var(--text-dim)'),
    });
  } else if (availability?.currentPrice != null && availability.currentPrice !== price) {
    chips.push({
      key: 'now',
      label: `Now $${availability.currentPrice.toLocaleString()}`,
      title: 'The source now shows a different rent than when this was saved.',
      style: pill('rgba(59,130,246,0.12)', '#1d4ed8'),
    });
  }

  if (was !== null) {
    const drop = was > price;
    const pct = Math.round((Math.abs(was - price) / was) * 100);
    chips.push({
      key: 'price',
      label: `${drop ? '↓' : '↑'} was $${was.toLocaleString()} (${pct}%)`,
      title: drop ? 'Rent cut since we first saw this listing.' : 'Rent raised since we first saw this listing.',
      style: drop ? pill('rgba(16,185,129,0.14)', '#047857') : pill('rgba(239,68,68,0.12)', '#b91c1c'),
    });
  }

  if (days !== null && days >= 1) {
    const stale = days >= 30;
    chips.push({
      key: 'days',
      label: `${days} day${days === 1 ? '' : 's'} on market`,
      title: stale
        ? 'Listed a month or more: in SF that usually means an issue with the unit, or a landlord who will negotiate.'
        : 'Days since the earlier of the posting date and our first crawl.',
      style: stale ? pill('rgba(245,158,11,0.14)', '#b45309') : pill('var(--bg)', 'var(--text-dim)'),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip.key} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={chip.style} title={chip.title}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
