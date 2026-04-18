import type { SortField, SortDirection } from '../types';

interface Props {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionChange: (dir: SortDirection) => void;
  resultCount: number;
  totalCount: number;
}

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'commute', label: 'Commute time' },
  { value: 'price', label: 'Price' },
  { value: 'sqft', label: 'Square footage' },
  { value: 'pricePerSqft', label: 'Price/sqft' },
];

export function SortControls({
  sortField, sortDirection,
  onSortFieldChange, onSortDirectionChange,
  resultCount, totalCount,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-400">
        Showing <span className="text-slate-200 font-medium">{resultCount}</span>
        {resultCount !== totalCount && (
          <> of <span className="text-slate-200 font-medium">{totalCount}</span></>
        )}
        {' '}listings
      </p>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-400">Sort by</label>
        <select
          value={sortField}
          onChange={e => onSortFieldChange(e.target.value as SortField)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 transition-colors"
          title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        >
          <svg className={`w-4 h-4 text-slate-300 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
