import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { AlertPrefs } from '../api/types';
import { getMetroById } from '../data/metros';

const NEIGHBORHOODS = (getMetroById('bay-area')?.neighborhoods ?? []).map((hood) => hood.name);

const inputStyle = {
  backgroundColor: 'var(--bg)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs space-y-1 block" style={{ color: 'var(--text-dim)' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Each roommate keeps their own filter and channels; nothing is shared here. */
export function AlertSettings() {
  const [prefs, setPrefs] = useState<AlertPrefs | null>(null);
  const [channels, setChannels] = useState({ email: false, discord: false });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .fetchAlertPrefs()
      .then((settings) => {
        if (!live) return;
        setPrefs(settings.prefs);
        setChannels(settings.channels);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : 'Could not load alert settings.');
      });
    return () => {
      live = false;
    };
  }, []);

  function update(patch: Partial<AlertPrefs>) {
    setPrefs((current) => (current ? { ...current, ...patch } : current));
    setStatus(null);
  }

  async function save() {
    if (!prefs) return;
    setError(null);
    try {
      const result = await api.saveAlertPrefs(prefs);
      setPrefs(result.prefs);
      setStatus('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save alert settings.');
    }
  }

  if (!prefs) return null;

  return (
    <div
      className="rounded-xl border"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-2 px-5 py-3 text-left"
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          New-listing alerts
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {prefs.enabled ? 'on' : 'off'} · yours only
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>
          {open ? 'Hide' : 'Edit'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
            />
            Alert me when a new listing matches
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Min rent">
              <input
                type="number"
                min={0}
                value={prefs.minRent}
                onChange={(event) => update({ minRent: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Max rent">
              <input
                type="number"
                min={1}
                value={prefs.maxRent}
                onChange={(event) => update({ maxRent: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Min bedrooms">
              <input
                type="number"
                min={0}
                max={8}
                value={prefs.minBedrooms}
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
                value={prefs.maxScamScore}
                onChange={(event) => update({ maxScamScore: Number(event.target.value) })}
                className="w-full rounded-lg px-2 py-1.5 text-sm border outline-none"
                style={inputStyle}
              />
            </Field>
          </div>

          <div className="space-y-1">
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Neighborhoods {prefs.neighborhoods.length === 0 && '(none selected = anywhere)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NEIGHBORHOODS.map((hood) => {
                const on = prefs.neighborhoods.includes(hood);
                return (
                  <button
                    key={hood}
                    type="button"
                    onClick={() =>
                      update({
                        neighborhoods: on
                          ? prefs.neighborhoods.filter((item) => item !== hood)
                          : [...prefs.neighborhoods, hood],
                      })
                    }
                    className="text-[11px] px-2.5 py-1 rounded-full border"
                    style={{
                      borderColor: on ? 'var(--accent)' : 'var(--border)',
                      color: on ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  >
                    {hood}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={prefs.viaEmail}
                disabled={!channels.email}
                onChange={(event) => update({ viaEmail: event.target.checked })}
              />
              Email {!channels.email && '(SMTP not configured)'}
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={prefs.viaDiscord}
                disabled={!channels.discord}
                onChange={(event) => update({ viaDiscord: event.target.checked })}
              />
              Discord {!channels.discord && '(no webhook configured)'}
            </label>
            <button
              onClick={() => void save()}
              className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Save
            </button>
          </div>

          {status && (
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {status}
            </p>
          )}
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
