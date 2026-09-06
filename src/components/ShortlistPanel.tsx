import { useState } from 'react';
import { useShortlist } from '../hooks/useShortlist';
import { SavedListingCard } from './SavedListingCard';
import { ShareButton } from './ShareButton';
import { ShareGroupsPanel } from './ShareGroupsPanel';
import { TourSchedule } from './TourSchedule';

interface PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortlistPanel({ open, onOpenChange }: PanelProps) {
  const { saved, error, removeAll } = useShortlist();
  const [confirmingRemoveAll, setConfirmingRemoveAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showGroups, setShowGroups] = useState(false);

  if (saved.length === 0 && !error && !open) return null;

  const chosen = saved.filter((entry) => selected.has(entry.key));
  const sharing = chosen.length > 0 ? chosen : saved;

  function select(key: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const small = 'text-xs px-2 py-1 rounded-lg border';
  const smallStyle = { borderColor: 'var(--border)', color: 'var(--text-dim)' };

  return (
    <section
      id="shortlist"
      className="rounded-xl border"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          Shortlist
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {saved.length} saved by the group
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {error && <p className="px-4 pb-3 text-xs text-red-400">{error}</p>}

      {open && saved.length === 0 && (
        <p className="px-4 pb-4 text-xs" style={{ color: 'var(--text-dim)' }}>
          Nothing saved yet. Tap the heart on a listing and it shows up here for everyone.
        </p>
      )}

      {open && saved.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {chosen.length > 0 ? `${chosen.length} selected` : 'Select places to share just those'}
            </span>
            {chosen.length > 0 && (
              <button onClick={() => setSelected(new Set())} className={small} style={smallStyle}>
                Clear selection
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={() => setShowGroups((was) => !was)} className={small} style={smallStyle}>
                {showGroups ? 'Hide groups' : 'Share groups'}
              </button>
              <ShareButton
                listings={sharing.map((entry) => entry.listing)}
                label={chosen.length > 0 ? `Share ${chosen.length} selected` : `Share all ${saved.length}`}
              />
              {confirmingRemoveAll ? (
                <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Remove all {saved.length}?
                  <button
                    onClick={() => {
                      setConfirmingRemoveAll(false);
                      void removeAll();
                    }}
                    className="font-semibold px-2 py-1 rounded-lg"
                    style={{ backgroundColor: '#ef4444', color: '#fff' }}
                  >
                    Remove
                  </button>
                  <button onClick={() => setConfirmingRemoveAll(false)} className={small} style={smallStyle}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmingRemoveAll(true)} className={small} style={smallStyle}>
                  Remove all
                </button>
              )}
            </div>
          </div>

          {showGroups && (
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <ShareGroupsPanel />
            </div>
          )}

          <TourSchedule />

          {/* Capped height so the shortlist reads as its own list you scroll,
              instead of pushing the page down forever. */}
          <div className="max-h-[32rem] overflow-y-auto overscroll-contain pr-1 space-y-3">
            {saved.map((entry) => (
              <SavedListingCard
                key={entry.key}
                entry={entry}
                selected={selected.has(entry.key)}
                onSelect={(on) => select(entry.key, on)}
              />
            ))}
          </div>

          {saved.length > 2 && (
            <p className="text-[11px] text-center" style={{ color: 'var(--text-dim)' }}>
              Scroll for the rest of the {saved.length} saved places
            </p>
          )}
        </div>
      )}
    </section>
  );
}
