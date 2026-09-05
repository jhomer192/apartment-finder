import { useState } from 'react';
import type { SearchParams } from '../types';
import { DEFAULT_SEARCH } from '../data/search';

interface Props {
  onSearch: (params: SearchParams) => void;
  /** Puts the search back to every SF listing, including any neighborhood pills. */
  onClearAll: () => void;
  loading: boolean;
}

const MAX_ROOMS = 6;

function parseRoom(value: string): number | null {
  return value === 'any' ? null : parseInt(value, 10);
}

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = {
  backgroundColor: 'var(--bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
};

interface RangeProps {
  id: string;
  label: string;
  /** Rendered for each option; studios are "Studio" rather than "0 bd". */
  optionLabel: (count: number) => string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}

/** A "from / to" pair, so 3–5 bedrooms is one selection rather than three searches. */
function RoomRange({ id, label, optionLabel, min, max, onMin, onMax }: RangeProps) {
  const counts = Array.from({ length: MAX_ROOMS + 1 }, (_, count) => count);
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }} htmlFor={`${id}-min`}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <select
          id={`${id}-min`}
          aria-label={`Minimum ${label.toLowerCase()}`}
          value={min}
          onChange={(e) => onMin(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="any">Any</option>
          {counts.map((count) => (
            <option key={count} value={String(count)}>
              {optionLabel(count)}
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          to
        </span>
        <select
          id={`${id}-max`}
          aria-label={`Maximum ${label.toLowerCase()}`}
          value={max}
          onChange={(e) => onMax(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="any">Any</option>
          {counts.map((count) => (
            <option key={count} value={String(count)}>
              {optionLabel(count)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SearchForm({ onSearch, onClearAll, loading }: Props) {
  const [minRent, setMinRent] = useState(DEFAULT_SEARCH.minRent);
  const [maxRent, setMaxRent] = useState(DEFAULT_SEARCH.maxRent);
  const [minBedrooms, setMinBedrooms] = useState<string>('any');
  const [maxBedrooms, setMaxBedrooms] = useState<string>('any');
  const [minBathrooms, setMinBathrooms] = useState<string>('any');
  const [maxBathrooms, setMaxBathrooms] = useState<string>('any');
  const [dedupe, setDedupe] = useState(DEFAULT_SEARCH.dedupe);

  function paramsWith(nextDedupe: boolean): SearchParams {
    return {
      minRent,
      maxRent,
      minBedrooms: parseRoom(minBedrooms),
      maxBedrooms: parseRoom(maxBedrooms),
      minBathrooms: parseRoom(minBathrooms),
      maxBathrooms: parseRoom(maxBathrooms),
      dedupe: nextDedupe,
    };
  }

  function handleClear() {
    setMinRent(DEFAULT_SEARCH.minRent);
    setMaxRent(DEFAULT_SEARCH.maxRent);
    setMinBedrooms('any');
    setMaxBedrooms('any');
    setMinBathrooms('any');
    setMaxBathrooms('any');
    setDedupe(DEFAULT_SEARCH.dedupe);
    onClearAll();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(paramsWith(dedupe));
  }

  // Re-searches on the spot: a checkbox that needed a second button press to
  // take effect reads as broken.
  function handleDedupe(next: boolean) {
    setDedupe(next);
    onSearch(paramsWith(next));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }} htmlFor="min-rent">
            Rent from
          </label>
          <input
            id="min-rent"
            type="number"
            value={minRent}
            onChange={e => setMinRent(Number(e.target.value))}
            className={inputClass}
            style={inputStyle}
            min={0}
            step={100}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }} htmlFor="max-rent">
            Rent up to
          </label>
          <input
            id="max-rent"
            type="number"
            value={maxRent}
            onChange={e => setMaxRent(Number(e.target.value))}
            className={inputClass}
            style={inputStyle}
            min={0}
            step={100}
          />
        </div>

        <RoomRange
          id="bedrooms"
          label="Bedrooms"
          optionLabel={(count) => (count === 0 ? 'Studio' : `${count} bd`)}
          min={minBedrooms}
          max={maxBedrooms}
          onMin={setMinBedrooms}
          onMax={setMaxBedrooms}
        />

        <RoomRange
          id="bathrooms"
          label="Bathrooms"
          optionLabel={(count) => `${count} ba`}
          min={minBathrooms}
          max={maxBathrooms}
          onMin={setMinBathrooms}
          onMax={setMaxBathrooms}
        />

        <button
          type="submit"
          disabled={loading}
          className="font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
        >
          {loading ? 'Loading…' : 'Update listings'}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={loading}
          className="font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
          style={{ border: '1px solid var(--border)', color: 'var(--text-dim)' }}
        >
          Clear all
        </button>
      </div>

      <label className="flex items-center gap-2 mt-3 text-xs cursor-pointer" style={{ color: 'var(--text-dim)' }}>
        <input
          type="checkbox"
          checked={!dedupe}
          onChange={(e) => handleDedupe(!e.target.checked)}
          disabled={loading}
          className="accent-[var(--accent)]"
        />
        Show every site&rsquo;s copy of a listing (off: one card per apartment, with the other sites on it)
      </label>
    </form>
  );
}
