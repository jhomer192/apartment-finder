import { useState } from 'react';
import type { SearchParams } from '../types';
import { DEFAULT_SEARCH } from '../data/search';

interface Props {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: Props) {
  const [minRent, setMinRent] = useState(DEFAULT_SEARCH.minRent);
  const [maxRent, setMaxRent] = useState(DEFAULT_SEARCH.maxRent);
  const [bedrooms, setBedrooms] = useState<string>('any');
  const [minBathrooms, setMinBathrooms] = useState<string>('any');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({
      minRent,
      maxRent,
      bedrooms: bedrooms === 'any' ? null : parseInt(bedrooms, 10),
      minBathrooms: minBathrooms === 'any' ? null : parseInt(minBathrooms, 10),
    });
  }

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  const inputStyle = { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
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

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }} htmlFor="bedrooms">
            Bedrooms
          </label>
          <select
            id="bedrooms"
            value={bedrooms}
            onChange={e => setBedrooms(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="any">Any</option>
            <option value="0">Studio</option>
            <option value="1">1 BR</option>
            <option value="2">2 BR</option>
            <option value="3">3 BR</option>
            <option value="4">4 BR</option>
            <option value="5">5 BR</option>
            <option value="6">6 BR</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-dim)' }} htmlFor="bathrooms">
            Bathrooms
          </label>
          <select
            id="bathrooms"
            value={minBathrooms}
            onChange={e => setMinBathrooms(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="any">Any</option>
            <option value="1">1+ ba</option>
            <option value="2">2+ ba</option>
            <option value="3">3+ ba</option>
            <option value="4">4+ ba</option>
            <option value="5">5+ ba</option>
            <option value="6">6+ ba</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
        >
          {loading ? 'Loading…' : 'Update listings'}
        </button>
      </div>
    </form>
  );
}
