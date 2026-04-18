import { useState } from 'react';
import type { SearchParams } from '../types';
import { MetroSelector } from './MetroSelector';

interface Props {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: Props) {
  const [metros, setMetros] = useState<string[]>(['bay-area']);
  const [minRent, setMinRent] = useState(1500);
  const [maxRent, setMaxRent] = useState(6000);
  const [bedrooms, setBedrooms] = useState<string>('any');
  const [officeAddress, setOfficeAddress] = useState('Salesforce Tower');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({
      metros,
      minRent,
      maxRent,
      bedrooms: bedrooms === 'any' ? null : parseInt(bedrooms, 10),
      officeAddress,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-700">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Find apartments</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium text-slate-400 mb-1">Metro areas</label>
          <MetroSelector selected={metros} onChange={setMetros} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Min rent</label>
          <input
            type="number"
            value={minRent}
            onChange={e => setMinRent(Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={0}
            step={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Max rent</label>
          <input
            type="number"
            value={maxRent}
            onChange={e => setMaxRent(Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={0}
            step={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Bedrooms</label>
          <select
            value={bedrooms}
            onChange={e => setBedrooms(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <label className="block text-sm font-medium text-slate-400 mb-1">Office address (for commute)</label>
          <input
            type="text"
            value={officeAddress}
            onChange={e => setOfficeAddress(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="123 Market St, SF"
            required
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || metros.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
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
