import { useState, useEffect } from 'react';
import type { SearchParams } from '../types';
import { MetroSelector, hoodKey } from './MetroSelector';
import { METROS } from '../data/metros';

interface Props {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: Props) {
  const [metros, setMetros] = useState<string[]>(['bay-area']);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<Set<string>>(() => {
    // Initialize: all Bay Area neighborhoods selected
    const initial = new Set<string>();
    const bayArea = METROS.find(m => m.id === 'bay-area');
    if (bayArea) {
      bayArea.neighborhoods.forEach(n => initial.add(hoodKey('bay-area', n.name)));
    }
    return initial;
  });
  const [minRent, setMinRent] = useState(1500);
  const [maxRent, setMaxRent] = useState(6000);
  const [bedrooms, setBedrooms] = useState<string>('any');
  const [officeAddress, setOfficeAddress] = useState('Salesforce Tower');

  // When metros change externally (shouldn't happen often), ensure neighborhood set stays consistent
  useEffect(() => {
    // Remove neighborhoods for metros that are no longer selected
    setSelectedNeighborhoods(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const metroId = key.split('::')[0];
        if (metros.includes(metroId)) {
          next.add(key);
        }
      });
      return next;
    });
  // Only re-run when metros array identity changes (it won't on every render thanks to MetroSelector)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metros.join(',')]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Convert Set<string> to string[] for the search params
    const neighborhoods = Array.from(selectedNeighborhoods);

    onSearch({
      metros,
      selectedNeighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
      minRent,
      maxRent,
      bedrooms: bedrooms === 'any' ? null : parseInt(bedrooms, 10),
      officeAddress,
    });
  }

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl p-6 shadow-lg border" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Find apartments</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Metro areas</label>
          <MetroSelector
            selected={metros}
            onChange={setMetros}
            selectedNeighborhoods={selectedNeighborhoods}
            onNeighborhoodsChange={setSelectedNeighborhoods}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Min rent</label>
          <input
            type="number"
            value={minRent}
            onChange={e => setMinRent(Number(e.target.value))}
            className={inputClass}
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border)' }}
            min={0}
            step={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Max rent</label>
          <input
            type="number"
            value={maxRent}
            onChange={e => setMaxRent(Number(e.target.value))}
            className={inputClass}
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border)' }}
            min={0}
            step={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Bedrooms</label>
          <select
            value={bedrooms}
            onChange={e => setBedrooms(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <option value="any">Any</option>
            <option value="0">Studio</option>
            <option value="1">1 BR</option>
            <option value="2">2 BR</option>
            <option value="3">3 BR</option>
            <option value="4">4 BR</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-dim)' }}>Office address (for commute)</label>
          <input
            type="text"
            value={officeAddress}
            onChange={e => setOfficeAddress(e.target.value)}
            className={inputClass}
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border)' }}
            placeholder="123 Market St, SF"
            required
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || metros.length === 0}
            className="w-full font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
