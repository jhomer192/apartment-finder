import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchInventory, startInventoryRefresh } from '../api/client';
import type { InventoryStatus } from '../api/types';

interface Props {
  /** Called once a refresh finishes, so the results reflect what was just pulled. */
  onRefreshed: () => void;
}

const POLL_MS = 10_000;

function ago(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function summary(status: InventoryStatus): string {
  const parts = [`${status.listings.toLocaleString()} listings stored`];
  if (status.refreshedAt) parts.push(`pulled ${ago(status.refreshedAt)}`);
  const broken = status.sources.filter((source) => source.error !== null).map((source) => source.name);
  if (broken.length > 0) parts.push(`${broken.join(' and ')} unavailable last pull`);
  return parts.join(' · ');
}

export function InventoryBar({ onRefreshed }: Props) {
  const [status, setStatus] = useState<InventoryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRefreshing = useRef(false);

  const load = useCallback(() => {
    // A failed poll says nothing about the listings already on screen, so it is
    // swallowed rather than shown.
    return fetchInventory()
      .then((next) => {
        setStatus(next);
        if (wasRefreshing.current && !next.refreshing) onRefreshed();
        wasRefreshing.current = next.refreshing;
      })
      .catch(() => undefined);
  }, [onRefreshed]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only while a crawl is running: it takes minutes, and the button should stop
  // spinning on its own when it lands.
  useEffect(() => {
    if (!status?.refreshing) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [status?.refreshing, load]);

  async function refresh() {
    setError(null);
    try {
      setStatus(await startInventoryRefresh());
      wasRefreshing.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start a refresh.');
    }
  }

  if (!status) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-dim)' }}>
      <span>{summary(status)}</span>
      <button
        onClick={() => void refresh()}
        disabled={status.refreshing}
        className="font-medium px-2.5 py-1 rounded-lg border disabled:opacity-60"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        title="Pull every listing from the sources again. Takes a few minutes; it also runs nightly."
      >
        {status.refreshing ? 'Refreshing…' : 'Refresh listings'}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
