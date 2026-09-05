import type { SortOption } from '../types';

interface Props {
  sort: SortOption;
  onChange: (sort: SortOption) => void;
}

/** Grouped so the money sorts, the location sorts and the risk sorts are separable at a glance. */
export function SortSelect({ sort, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
      Sort by
      <select
        value={sort}
        onChange={(e) => onChange(e.target.value as SortOption)}
        className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
      >
        <optgroup label="Price">
          <option value="price-asc">Cheapest rent</option>
          <option value="ppbed">Cheapest per bedroom</option>
          <option value="ppsqft">Cheapest per sqft</option>
          <option value="price-desc">Priciest rent</option>
        </optgroup>
        <optgroup label="Size">
          <option value="sqft-desc">Largest</option>
        </optgroup>
        <optgroup label="Area">
          <option value="safety">Best area safety rating</option>
          <option value="incidents">Lowest incident rate per resident</option>
          <option value="transit">Closest to a train</option>
        </optgroup>
        <optgroup label="Scam risk">
          <option value="scam">Safest listings first</option>
          <option value="scam-desc">Riskiest listings first</option>
        </optgroup>
      </select>
    </label>
  );
}
