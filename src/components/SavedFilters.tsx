import { useEffect, useRef, useState } from 'react';
import type { SavedFilter, StoredFilter } from '../api/types';
import { ApiError, deleteFilter, fetchFilters, saveFilter } from '../api/client';

interface Props {
  /** The search on screen right now, which "Save this search" stores under a name. */
  current: Omit<SavedFilter, 'name'>;
  onApply: (filter: SavedFilter) => void;
}

function describe(filter: SavedFilter): string {
  const parts = [`$${filter.minRent.toLocaleString()}–$${filter.maxRent.toLocaleString()}`];
  if (filter.minBedrooms !== null || filter.maxBedrooms !== null) {
    parts.push(`${filter.minBedrooms ?? 'any'}–${filter.maxBedrooms ?? 'any'} bd`);
  }
  if (filter.minBathrooms !== null || filter.maxBathrooms !== null) {
    parts.push(`${filter.minBathrooms ?? 'any'}–${filter.maxBathrooms ?? 'any'} ba`);
  }
  if (filter.neighborhoods.length > 0) parts.push(filter.neighborhoods.join(', '));
  return parts.join(' · ');
}

/** Just the search, without the row it happens to live in on the server. */
function portable(filter: SavedFilter): SavedFilter {
  return {
    name: filter.name,
    minRent: filter.minRent,
    maxRent: filter.maxRent,
    minBedrooms: filter.minBedrooms,
    maxBedrooms: filter.maxBedrooms,
    minBathrooms: filter.minBathrooms,
    maxBathrooms: filter.maxBathrooms,
    dedupe: filter.dedupe,
    neighborhoods: filter.neighborhoods,
    sort: filter.sort,
  };
}

/** The export file, so an import can tell a saved search from any other JSON. */
interface ExportFile {
  app: 'apartment-finder';
  filters: SavedFilter[];
}

function filtersIn(payload: unknown): SavedFilter[] {
  const list = Array.isArray(payload) ? payload : (payload as ExportFile | null)?.filters;
  if (!Array.isArray(list)) return [];
  return list.filter((filter): filter is SavedFilter =>
    typeof (filter as SavedFilter)?.name === 'string' && (filter as SavedFilter).name.trim() !== '',
  );
}

export function SavedFilters({ current, onApply }: Props) {
  const [filters, setFilters] = useState<StoredFilter[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFilters()
      .then((payload) => setFilters(payload.filters))
      .catch(() => setError('Could not load your saved searches.'));
  }, []);

  function report(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 4000);
  }

  async function reload() {
    setFilters((await fetchFilters()).filters);
  }

  async function save(filter: SavedFilter) {
    const { filter: stored } = await saveFilter(filter);
    setFilters((current) => [...current.filter((other) => other.id !== stored.id), stored].sort(byName));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await save({ ...current, name: trimmed });
      setName('');
      report(`Saved “${trimmed}”.`);
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : 'Could not save that search.');
    }
  }

  async function handleDelete(filter: StoredFilter) {
    setError(null);
    try {
      await deleteFilter(filter.id);
      setFilters((current) => current.filter((other) => other.id !== filter.id));
    } catch {
      setError('Could not delete that search.');
    }
  }

  function handleExport() {
    const file: ExportFile = {
      app: 'apartment-finder',
      filters: filters.map(portable),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'apartment-finder-searches.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);

    let incoming: SavedFilter[] = [];
    try {
      incoming = filtersIn(JSON.parse(await file.text()) as unknown);
    } catch {
      setError('That file is not a saved-search export.');
      return;
    }
    if (incoming.length === 0) {
      setError('That file has no saved searches in it.');
      return;
    }

    // One bad entry should not lose the rest, so each is saved on its own and
    // the count says how many landed.
    let saved = 0;
    for (const filter of incoming) {
      try {
        await save(filter);
        saved += 1;
      } catch {
        /* reported through the count below */
      }
    }
    await reload();
    report(
      saved === incoming.length
        ? `Imported ${saved} search${saved === 1 ? '' : 'es'}.`
        : `Imported ${saved} of ${incoming.length}; the rest were not valid searches.`,
    );
  }

  return (
    <section
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Saved searches
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Run the group&rsquo;s checks again without rebuilding them
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={filters.length === 0}
            className="text-xs px-2 py-1 rounded-lg border disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="text-xs px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import saved searches"
            onChange={(event) => void handleImport(event)}
          />
        </div>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <span
              key={filter.id}
              className="inline-flex items-center rounded-full border text-xs overflow-hidden"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                type="button"
                onClick={() => onApply(filter)}
                title={describe(filter)}
                className="px-3 py-1 font-medium"
                style={{ color: 'var(--text)' }}
              >
                {filter.name}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(filter)}
                aria-label={`Delete the saved search ${filter.name}`}
                className="px-2 py-1"
                style={{ color: 'var(--text-dim)' }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={(event) => void handleSave(event)} className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this search (e.g. 3 bd under $6k)"
          maxLength={60}
          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          type="submit"
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Save this search
        </button>
      </form>

      {status && (
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {status}
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}

function byName(a: StoredFilter, b: StoredFilter): number {
  return a.name.localeCompare(b.name);
}
