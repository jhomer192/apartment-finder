import type { AreaFacts } from '../types';

type Safety = NonNullable<AreaFacts['safety']>;

interface Props {
  safety: Safety | null | undefined;
}

const GRADE_COLOR: Record<Safety['grade'], string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  E: '#ef4444',
};

function summary(safety: Safety): string {
  if (safety.quieterThanPercent >= 80) return 'Among the quietest blocks in SF';
  if (safety.quieterThanPercent >= 60) return 'Quieter than most of SF';
  if (safety.quieterThanPercent >= 40) return 'About average for SF';
  if (safety.quieterThanPercent >= 20) return 'Busier than most of SF';
  return 'Among the busiest blocks in SF';
}

/**
 * A rating of reported violent crime around the address relative to the rest of
 * the city. The wording stays comparative on purpose: police reports measure
 * what gets reported, not how a block will treat the person living on it.
 */
export function SafetyRating({ safety }: Props) {
  if (!safety) return null;

  const color = GRADE_COLOR[safety.grade];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
      title={
        `${safety.violentCount} violent-crime reports (assault, robbery, weapons, sexual offences, homicide) ` +
        `were filed within ${safety.radiusMeters}m of this address in the last 12 months — fewer than ` +
        `${safety.quieterThanPercent}% of blocks across San Francisco. Source: DataSF police incident reports. ` +
        'Reports are not convictions, and a grade describes the area, not this building.'
      }
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
        style={{ backgroundColor: color, color: '#0b1220' }}
      >
        {safety.grade}
      </span>
      Area safety: {summary(safety)}
    </span>
  );
}
