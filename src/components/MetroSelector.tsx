import { useState, useRef, useEffect } from 'react';
import { METROS } from '../data/metros';

interface Props {
  selected: string[];
  onChange: (metros: string[]) => void;
  selectedNeighborhoods: Set<string>;
  onNeighborhoodsChange: (neighborhoods: Set<string>) => void;
}

/** Unique key for a neighborhood across metros */
function hoodKey(metroId: string, hoodName: string): string {
  return `${metroId}::${hoodName}`;
}

export function MetroSelector({ selected, onChange, selectedNeighborhoods, onNeighborhoodsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleMetro(id: string) {
    const metro = METROS.find(m => m.id === id);
    if (!metro) return;

    if (selected.includes(id)) {
      // Deselecting metro: remove it and all its neighborhoods
      onChange(selected.filter(m => m !== id));
      const next = new Set(selectedNeighborhoods);
      metro.neighborhoods.forEach(n => next.delete(hoodKey(id, n.name)));
      onNeighborhoodsChange(next);
    } else {
      // Selecting metro: add it and all its neighborhoods
      onChange([...selected, id]);
      const next = new Set(selectedNeighborhoods);
      metro.neighborhoods.forEach(n => next.add(hoodKey(id, n.name)));
      onNeighborhoodsChange(next);
      // Auto-expand so user sees the neighborhoods
      setExpanded(prev => new Set(prev).add(id));
    }
  }

  function removeMetro(id: string) {
    const metro = METROS.find(m => m.id === id);
    onChange(selected.filter(m => m !== id));
    if (metro) {
      const next = new Set(selectedNeighborhoods);
      metro.neighborhoods.forEach(n => next.delete(hoodKey(id, n.name)));
      onNeighborhoodsChange(next);
    }
  }

  function toggleHood(metroId: string, hoodName: string) {
    const key = hoodKey(metroId, hoodName);
    const next = new Set(selectedNeighborhoods);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onNeighborhoodsChange(next);
  }

  function selectAllHoods(metroId: string) {
    const metro = METROS.find(m => m.id === metroId);
    if (!metro) return;
    const next = new Set(selectedNeighborhoods);
    metro.neighborhoods.forEach(n => next.add(hoodKey(metroId, n.name)));
    onNeighborhoodsChange(next);
  }

  function deselectAllHoods(metroId: string) {
    const metro = METROS.find(m => m.id === metroId);
    if (!metro) return;
    const next = new Set(selectedNeighborhoods);
    metro.neighborhoods.forEach(n => next.delete(hoodKey(metroId, n.name)));
    onNeighborhoodsChange(next);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function hoodCount(metroId: string): { on: number; total: number } {
    const metro = METROS.find(m => m.id === metroId);
    if (!metro) return { on: 0, total: 0 };
    const total = metro.neighborhoods.length;
    const on = metro.neighborhoods.filter(n => selectedNeighborhoods.has(hoodKey(metroId, n.name))).length;
    return { on, total };
  }

  const lowerSearch = search.toLowerCase();
  const filteredMetros = METROS.filter(m =>
    m.name.toLowerCase().includes(lowerSearch) ||
    m.neighborhoods.some(n => n.name.toLowerCase().includes(lowerSearch))
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected pills */}
      <div
        className="w-full rounded-lg px-3 py-2 cursor-pointer min-h-[42px] flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 && (
          <span style={{ color: 'var(--text-dim)' }}>Select metro areas...</span>
        )}
        {selected.map(id => {
          const metro = METROS.find(m => m.id === id);
          if (!metro) return null;
          const { on, total } = hoodCount(id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
            >
              {metro.name}
              <span className="opacity-70">({on}/{total})</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeMetro(id); }}
                className="hover:opacity-70 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
        <svg className={`w-4 h-4 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-dim)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg shadow-xl max-h-[28rem] overflow-y-auto" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Search input */}
          <div className="p-2 border-b sticky top-0 z-10" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter metros & neighborhoods..."
              className="w-full rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>

          {filteredMetros.map(metro => {
            const isSelected = selected.includes(metro.id);
            const isExpanded = expanded.has(metro.id);
            const matchingHoods = search
              ? metro.neighborhoods.filter(n => n.name.toLowerCase().includes(lowerSearch))
              : [];
            const showHoods = isExpanded || matchingHoods.length > 0;
            const hoodsToShow = search ? matchingHoods : metro.neighborhoods;
            const { on, total } = hoodCount(metro.id);

            return (
              <div key={metro.id} className="last:border-b-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                <div className="flex items-center gap-2 px-3 py-2 transition-colors" style={{ cursor: 'pointer' }}>
                  <label className="flex items-center gap-2 flex-1 cursor-pointer" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMetro(metro.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{metro.name}</span>
                    {isSelected ? (
                      <span className="text-xs" style={{ color: on === total ? 'var(--accent)' : 'var(--text-dim)' }}>
                        {on}/{total} neighborhoods
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{total} neighborhoods</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleExpand(metro.id); }}
                    className="p-1 transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>

                {showHoods && (
                  <div className="px-3 pb-2">
                    {/* Select All / Deselect All buttons (only when metro is selected) */}
                    {isSelected && (
                      <div className="flex gap-2 pl-6 mb-1.5">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); selectAllHoods(metro.id); }}
                          className="text-xs px-2 py-0.5 rounded transition-colors hover:opacity-80"
                          style={{ color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); deselectAllHoods(metro.id); }}
                          className="text-xs px-2 py-0.5 rounded transition-colors hover:opacity-80"
                          style={{ color: 'var(--text-dim)', backgroundColor: 'color-mix(in srgb, var(--border) 50%, transparent)' }}
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pl-6">
                      {hoodsToShow.map(n => {
                        const key = hoodKey(metro.id, n.name);
                        const isOn = selectedNeighborhoods.has(key);
                        return (
                          <button
                            key={n.name}
                            type="button"
                            onClick={e => { e.stopPropagation(); if (isSelected) toggleHood(metro.id, n.name); }}
                            className="text-xs px-2 py-0.5 rounded-full transition-all"
                            style={
                              !isSelected
                                ? { color: 'var(--text-dim)', backgroundColor: 'color-mix(in srgb, var(--border) 50%, transparent)', cursor: 'default', opacity: 0.6 }
                                : isOn
                                  ? { color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', cursor: 'pointer' }
                                  : { color: 'var(--text-dim)', backgroundColor: 'color-mix(in srgb, var(--border) 30%, transparent)', border: '1px solid transparent', opacity: 0.5, cursor: 'pointer' }
                            }
                          >
                            {n.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredMetros.length === 0 && (
            <div className="p-4 text-sm text-center" style={{ color: 'var(--text-dim)' }}>No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}

export { hoodKey };
