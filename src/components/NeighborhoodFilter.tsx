interface Props {
  neighborhoods: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function NeighborhoodFilter({ neighborhoods, selected, onChange }: Props) {
  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(neighborhoods));
  }

  function selectNone() {
    onChange(new Set());
  }

  const allSelected = selected.size === neighborhoods.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-dim)' }}>
          Filter by neighborhood ({selected.size}/{neighborhoods.length})
        </span>
        <button
          type="button"
          onClick={allSelected ? selectNone : selectAll}
          className="text-xs font-medium transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {neighborhoods.map(name => {
          const active = selected.has(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
              style={active ? {
                backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                color: 'var(--accent)',
                border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
              } : {
                backgroundColor: 'transparent',
                color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                opacity: 0.7,
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
