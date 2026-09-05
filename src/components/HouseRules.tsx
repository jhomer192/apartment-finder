import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { HouseRules as Rules } from '../api/types';
import { getMetroById } from '../data/metros';

const NEIGHBORHOODS = (getMetroById('bay-area')?.neighborhoods ?? []).map((hood) => hood.name);

const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

/** Same wording the server sends Claude, so the two never disagree on screen. */
function summarize(rules: Rules): string[] {
  const parts: string[] = [];
  if (rules.excludedNeighborhoods.length > 0) {
    parts.push(`never ${rules.excludedNeighborhoods.join(', ')}`);
  }
  if (rules.maxRent > 0) parts.push(`under $${rules.maxRent.toLocaleString()}`);
  if (rules.maxRentPerBedroom > 0) {
    parts.push(`under $${rules.maxRentPerBedroom.toLocaleString()} per bedroom`);
  }
  if (rules.minBedrooms > 0) parts.push(`${rules.minBedrooms}+ bedrooms`);
  if (rules.maxScamScore < 100) parts.push(`scam risk under ${rules.maxScamScore}`);
  return parts;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs space-y-1 block" style={{ color: 'var(--text-dim)' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/**
 * Shared by the whole group, unlike alert settings: everyone is renting the
 * same apartment, so ruling a neighborhood out rules it out for all of them,
 * in browsing, in Claude's answers and in alerts.
 */
export function HouseRulesBar({ onSaved }: { onSaved: () => void }) {
  const [rules, setRules] = useState<Rules | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .fetchRules()
      .then((stored) => {
        if (live) setRules(stored.rules);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load non-negotiables.');
      });
    return () => {
      live = false;
    };
  }, []);

  function update(patch: Partial<Rules>) {
    setRules((current) => (current ? { ...current, ...patch } : current));
  }

  async function save() {
    if (!rules) return;
    setSaving(true);
    setError(null);
    try {
      const stored = await api.saveRules(rules);
      setRules(stored.rules);
      setOpen(false);
      // Whatever is on screen was filtered under the old rules.
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save non-negotiables.');
    } finally {
      setSaving(false);
    }
  }

  if (!rules) return null;
  const summary = summarize(rules);

  return (
    <div
      className="rounded-xl border"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Non-negotiables
        </span>
        {summary.length === 0 ? (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
            none set — nothing is filtered out permanently
          </span>
        ) : (
          summary.map((part) => (
            <span
              key={part}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: 'var(--accent)',
              }}
            >
              {part}
            </span>
          ))
        )}
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          · applies to every search, Claude and alerts, for everyone
        </span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto text-xs font-medium px-2.5 py-1.5 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {open ? 'Hide' : 'Edit'}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="space-y-1">
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Neighborhoods nobody will live in
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NEIGHBORHOODS.map((hood) => {
                const off = rules.excludedNeighborhoods.includes(hood);
                return (
                  <button
                    key={hood}
                    type="button"
                    onClick={() =>
                      update({
                        excludedNeighborhoods: off
                          ? rules.excludedNeighborhoods.filter((item) => item !== hood)
                          : [...rules.excludedNeighborhoods, hood],
                      })
                    }
                    className="text-[11px] px-2.5 py-1 rounded-full border"
                    style={{
                      borderColor: off ? '#ef4444' : 'var(--border)',
                      color: off ? '#ef4444' : 'var(--text-dim)',
                      textDecoration: off ? 'line-through' : 'none',
                    }}
                  >
                    {hood}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Max rent (0 = any)">
              <input
                type="number"
                min={0}
                max={100000}
                value={rules.maxRent}
                onChange={(event) => update({ maxRent: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Max per bedroom (0 = any)">
              <input
                type="number"
                min={0}
                max={100000}
                value={rules.maxRentPerBedroom}
                onChange={(event) => update({ maxRentPerBedroom: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Min bedrooms">
              <input
                type="number"
                min={0}
                max={8}
                value={rules.minBedrooms}
                onChange={(event) => update({ minBedrooms: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Max scam score">
              <input
                type="number"
                min={0}
                max={100}
                value={rules.maxScamScore}
                onChange={(event) => update({ maxScamScore: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                update({
                  excludedNeighborhoods: [],
                  maxRent: 0,
                  maxRentPerBedroom: 0,
                  minBedrooms: 0,
                  maxScamScore: 100,
                })
              }
              className="text-xs font-medium underline"
              style={{ color: 'var(--accent)' }}
            >
              Clear all rules
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : 'Save for everyone'}
            </button>
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
