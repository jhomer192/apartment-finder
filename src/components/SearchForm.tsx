import { useState } from 'react';
import type { SearchParams, SortOption } from '../types';
import { DEFAULT_SEARCH } from '../data/search';
import { Popover } from './Popover';
import { NeighborhoodFilter } from './NeighborhoodFilter';
import { SortSelect } from './SortSelect';
import { sortLabel } from '../utils/sortOptions';

interface Props {
  /** The search that is actually running, so applying a saved one fills the boxes in. */
  params: SearchParams;
  onSearch: (params: SearchParams) => void;
  /** Puts the search back to every SF listing, including any neighborhood pills. */
  onClearAll: () => void;
  loading: boolean;
  neighborhoods: string[];
  selectedNeighborhoods: Set<string>;
  onNeighborhoods: (selected: Set<string>) => void;
  neighborhoodCounts: Map<string, number>;
  sort: SortOption;
  onSort: (sort: SortOption) => void;
}

const MAX_ROOMS = 6;

type Panel = 'price' | 'beds' | 'baths' | 'neighborhoods' | 'sort' | 'more';

function parseRoom(value: string): number | null {
  return value === 'any' ? null : parseInt(value, 10);
}

function roomValue(count: number | null): string {
  return count === null ? 'any' : String(count);
}

function rangeLabel(min: number | null, max: number | null, unit: string, fallback: string): string {
  if (min === null && max === null) return fallback;
  if (min !== null && min === max) return `${min} ${unit}`;
  if (min === null) return `Up to ${max} ${unit}`;
  if (max === null) return `${min}+ ${unit}`;
  return `${min}\u2013${max} ${unit}`;
}

function priceLabel(params: SearchParams): string {
  const changed = params.minRent !== DEFAULT_SEARCH.minRent || params.maxRent !== DEFAULT_SEARCH.maxRent;
  if (!changed) return 'Price';
  if (params.minRent === 0) return `Up to $${params.maxRent.toLocaleString()}`;
  return `$${params.minRent.toLocaleString()}\u2013$${params.maxRent.toLocaleString()}`;
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
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-dim)' }} htmlFor={`${id}-min`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
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

function Chevron() {
  return (
    <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/** Zillow-style filter row: each pill opens a small panel and applies as you change it. */
export function SearchForm({
  params,
  onSearch,
  onClearAll,
  loading,
  neighborhoods,
  selectedNeighborhoods,
  onNeighborhoods,
  neighborhoodCounts,
  sort,
  onSort,
}: Props) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [priceDraft, setPriceDraft] = useState({ min: params.minRent, max: params.maxRent });
  const [shown, setShown] = useState(params);

  // Applying a saved search changes the running search under the pills, and the
  // price boxes have to follow it.
  if (shown !== params) {
    setShown(params);
    setPriceDraft({ min: params.minRent, max: params.maxRent });
  }

  const close = () => setOpen(null);
  const toggle = (panel: Panel) => setOpen((current) => (current === panel ? null : panel));
  const apply = (patch: Partial<SearchParams>) => onSearch({ ...params, ...patch });

  function applyPrice() {
    const min = Math.max(0, priceDraft.min);
    const max = Math.max(min, priceDraft.max);
    apply({ minRent: min, maxRent: max });
    close();
  }

  const priceActive = params.minRent !== DEFAULT_SEARCH.minRent || params.maxRent !== DEFAULT_SEARCH.maxRent;
  const bedsActive = params.minBedrooms !== null || params.maxBedrooms !== null;
  const bathsActive = params.minBathrooms !== null || params.maxBathrooms !== null;
  const hoodsActive = selectedNeighborhoods.size > 0;
  const anyActive = priceActive || bedsActive || bathsActive || hoodsActive || !params.dedupe;

  const pill = (panel: Panel, active: boolean, label: string) => (
    <button
      type="button"
      onClick={() => toggle(panel)}
      aria-expanded={open === panel}
      className={`pill ${active ? 'pill-active' : ''}`}
      disabled={loading}
    >
      {label}
      <Chevron />
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open === 'price'} onClose={close} trigger={pill('price', priceActive, priceLabel(params))} className="lg:w-72">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            applyPrice();
          }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Monthly rent
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
              From
              <input
                type="number"
                value={priceDraft.min}
                onChange={(e) => setPriceDraft({ ...priceDraft, min: Number(e.target.value) })}
                className={`${inputClass} mt-1`}
                style={inputStyle}
                min={0}
                step={100}
              />
            </label>
            <label className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Up to
              <input
                type="number"
                value={priceDraft.max}
                onChange={(e) => setPriceDraft({ ...priceDraft, max: Number(e.target.value) })}
                className={`${inputClass} mt-1`}
                style={inputStyle}
                min={0}
                step={100}
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setPriceDraft({ min: DEFAULT_SEARCH.minRent, max: DEFAULT_SEARCH.maxRent });
                apply({ minRent: DEFAULT_SEARCH.minRent, maxRent: DEFAULT_SEARCH.maxRent });
                close();
              }}
              className="text-xs font-medium underline"
              style={{ color: 'var(--text-dim)' }}
            >
              Any price
            </button>
            <button
              type="submit"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Done
            </button>
          </div>
        </form>
      </Popover>

      <Popover
        open={open === 'beds'}
        onClose={close}
        trigger={pill('beds', bedsActive, rangeLabel(params.minBedrooms, params.maxBedrooms, 'bd', 'Beds'))}
        className="lg:w-72"
      >
        <RoomRange
          id="bedrooms"
          label="Bedrooms"
          optionLabel={(count) => (count === 0 ? 'Studio' : `${count} bd`)}
          min={roomValue(params.minBedrooms)}
          max={roomValue(params.maxBedrooms)}
          onMin={(value) => apply({ minBedrooms: parseRoom(value) })}
          onMax={(value) => apply({ maxBedrooms: parseRoom(value) })}
        />
      </Popover>

      <Popover
        open={open === 'baths'}
        onClose={close}
        trigger={pill('baths', bathsActive, rangeLabel(params.minBathrooms, params.maxBathrooms, 'ba', 'Baths'))}
        className="lg:w-72"
      >
        <RoomRange
          id="bathrooms"
          label="Bathrooms"
          optionLabel={(count) => `${count} ba`}
          min={roomValue(params.minBathrooms)}
          max={roomValue(params.maxBathrooms)}
          onMin={(value) => apply({ minBathrooms: parseRoom(value) })}
          onMax={(value) => apply({ maxBathrooms: parseRoom(value) })}
        />
      </Popover>

      <Popover
        open={open === 'neighborhoods'}
        onClose={close}
        trigger={pill(
          'neighborhoods',
          hoodsActive,
          hoodsActive
            ? selectedNeighborhoods.size === 1
              ? [...selectedNeighborhoods][0]
              : `${selectedNeighborhoods.size} neighborhoods`
            : 'Neighborhood',
        )}
        className="lg:w-[32rem]"
      >
        <NeighborhoodFilter
          neighborhoods={neighborhoods}
          selected={selectedNeighborhoods}
          onChange={onNeighborhoods}
          counts={neighborhoodCounts}
        />
      </Popover>

      <Popover open={open === 'sort'} onClose={close} trigger={pill('sort', false, `Sort: ${sortLabel(sort)}`)} className="lg:w-72" align="right">
        <SortSelect
          sort={sort}
          onChange={(next) => {
            onSort(next);
            close();
          }}
        />
      </Popover>

      <Popover open={open === 'more'} onClose={close} trigger={pill('more', !params.dedupe, 'More')} className="lg:w-80" align="right">
        <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: 'var(--text)' }}>
          <input
            type="checkbox"
            checked={!params.dedupe}
            onChange={(e) => apply({ dedupe: !e.target.checked })}
            disabled={loading}
            className="mt-1 accent-[var(--accent)]"
          />
          <span>
            Show every site&rsquo;s copy of a listing
            <span className="block text-xs" style={{ color: 'var(--text-dim)' }}>
              Off: one card per apartment, with the other sites linked on it.
            </span>
          </span>
        </label>
      </Popover>

      {anyActive && (
        <button
          type="button"
          onClick={() => {
            onClearAll();
            close();
          }}
          className="text-sm font-medium underline whitespace-nowrap"
          style={{ color: 'var(--text-dim)' }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
