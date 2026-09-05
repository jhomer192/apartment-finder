interface Props {
  neighborhoods: string[];
  /** Empty means every neighborhood, so nobody has to deselect twenty pills. */
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  counts: Map<string, number>;
}

export function NeighborhoodFilter({ neighborhoods, selected, onChange, counts }: Props) {
  const showingAll = selected.size === 0;

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
      <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
        {showingAll ? 'Showing every neighborhood' : `Showing ${selected.size} neighborhood${selected.size === 1 ? '' : 's'}`}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
          style={pillStyle(showingAll)}
        >
          All neighborhoods
        </button>
        {neighborhoods.map(name => (
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
      </div>
    </div>
  );
}
