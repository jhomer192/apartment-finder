import { useState } from 'react';
import type { ScamAssessment } from '../api/types';

const BAND_STYLES = {
  low: { color: '#22c55e', label: 'Nothing suspicious found', labelWithReasons: 'Minor things to check' },
  medium: { color: '#eab308', label: 'Worth a closer look' },
  high: { color: '#ef4444', label: 'Several scam warning signs' },
} as const;

interface Props {
  scam: ScamAssessment;
}

export function ScamBadge({ scam }: Props) {
  const [open, setOpen] = useState(false);
  const band = BAND_STYLES[scam.band];
  const label = scam.band === 'low' && scam.reasons.length > 0 ? BAND_STYLES.low.labelWithReasons : band.label;
  const hasDetail = scam.reasons.length > 0 || scam.checks.length > 0;
  const summary = scam.reasons[0]
    ?? (scam.checks.length > 0 ? `Passed ${scam.checks.length} check${scam.checks.length === 1 ? '' : 's'} on price, photos and address` : null);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
        style={{
          backgroundColor: `color-mix(in srgb, ${band.color} 14%, transparent)`,
          color: band.color,
          border: `1px solid color-mix(in srgb, ${band.color} 30%, transparent)`,
        }}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span aria-hidden>{hasDetail ? (open ? '▲ hide' : '▼ why') : ''}</span>
      </button>

      {!open && summary && (
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {summary}
        </p>
      )}

      {open && hasDetail && (
        <ul className="text-[11px] space-y-1" style={{ color: 'var(--text-dim)' }}>
          {scam.reasons.map((reason) => (
            <li key={reason}>
              <span style={{ color: BAND_STYLES.high.color }}>⚠</span> {reason}
            </li>
          ))}
          {scam.checks.map((check) => (
            <li key={check}>
              <span style={{ color: BAND_STYLES.low.color }}>✓</span> {check}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
