import type { SortOption } from '../types';
import { SORT_GROUPS } from '../utils/sortOptions';

interface Props {
  sort: SortOption;
  onChange: (sort: SortOption) => void;
}

export function SortSelect({ sort, onChange }: Props) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Sort by">
      {SORT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.options.map((option) => {
              const active = option.value === sort;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(option.value)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-lg flex items-center justify-between"
                  style={{
                    color: 'var(--text)',
                    backgroundColor: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {option.label}
                  {active && (
                    <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
