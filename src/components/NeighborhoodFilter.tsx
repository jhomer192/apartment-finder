import { useState } from 'react';

interface Props {
  neighborhoods: string[];
  /** Empty means every neighborhood, so nobody has to deselect twenty pills. */
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  counts: Map<string, number>;
}

/** Enough pills to choose from without a wall of them above the results. */
const COLLAPSED_COUNT = 10;

export function NeighborhoodFilter({ neighborhoods, selected, onChange, counts }: Props) {
  const [showAll, setShowAll] = useState(false);
  const showingAll = selected.size === 0;
  // A chosen neighborhood always stays visible, otherwise collapsing hides a
  // filter that is still being applied.
  const shown = showAll
    ? neighborhoods
    : neighborhoods.filter((name, index) => index < COLLAPSED_COUNT || selected.has(name));
  const hidden = neighborhoods.length - shown.length;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(next);
  }

  function pillStyle(active: boolean) {
    return active
      ? {
          backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
          color: 'var(--accent)',
          border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
        }
      : {
          backgroundColor: 'transparent',
          color: 'var(--text-dim)',
          border: '1px solid var(--border)',
        };
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
          {showingAll
            ? 'Neighborhood: every one'
            : `Neighborhood: ${[...selected].join(', ')}`}
        </span>
        {!showingAll && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="text-xs font-medium underline"
            style={{ color: 'var(--accent)' }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
          style={pillStyle(showingAll)}
        >
          All neighborhoods
        </button>
        {shown.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
            style={pillStyle(selected.has(name))}
          >
            {name}
            <span className="ml-1 opacity-60">{counts.get(name) ?? 0}</span>
          </button>
        ))}
        {(hidden > 0 || showAll) && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ color: 'var(--accent)', border: '1px dashed var(--border)' }}
          >
            {showAll ? 'Show fewer' : `Show ${hidden} more`}
          </button>
        )}
      </div>
    </div>
  );
}
