import { useState, useRef, useEffect } from 'react';
import { METROS } from '../data/metros';

interface Props {
  selected: string[];
  onChange: (metros: string[]) => void;
}

export function MetroSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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
    if (selected.includes(id)) {
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function removeMetro(id: string) {
    onChange(selected.filter(m => m !== id));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 cursor-pointer min-h-[42px] flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
        onClick={() => setOpen(!open)}
      >
        {selected.length === 0 && (
          <span className="text-slate-500">Select metro areas...</span>
        )}
        {selected.map(id => {
          const metro = METROS.find(m => m.id === id);
          if (!metro) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-blue-600/30 text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full border border-blue-500/30"
            >
              {metro.name}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeMetro(id); }}
                className="hover:text-blue-100 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
        <svg className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {/* Search input */}
          <div className="p-2 border-b border-slate-700 sticky top-0 bg-slate-800">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter metros & neighborhoods..."
              className="w-full bg-slate-700 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

            return (
              <div key={metro.id} className="border-b border-slate-700/50 last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 transition-colors">
                  {/* Checkbox */}
                  <label className="flex items-center gap-2 flex-1 cursor-pointer" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMetro(metro.id)}
                      className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-200">{metro.name}</span>
                    <span className="text-xs text-slate-500">{metro.neighborhoods.length} neighborhoods</span>
                  </label>
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleExpand(metro.id); }}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Expanded neighborhoods list */}
                {(isExpanded || matchingHoods.length > 0) && (
                  <div className="px-3 pb-2">
                    <div className="flex flex-wrap gap-1 pl-6">
                      {(search ? matchingHoods : metro.neighborhoods).map(n => (
                        <span
                          key={n.name}
                          className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded"
                        >
                          {n.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredMetros.length === 0 && (
            <div className="p-4 text-sm text-slate-500 text-center">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}
