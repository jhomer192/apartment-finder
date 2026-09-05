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
  const times = safety.cityRatePer100k > 0 ? safety.ratePer100k / safety.cityRatePer100k : 1;
  if (times <= 0.5) return 'Half the citywide crime rate or less';
  if (times <= 0.9) return 'Below the citywide crime rate';
  if (times <= 1.5) return 'Around the citywide crime rate';
  return `${times.toFixed(1)}× the citywide crime rate`;
}

/**
 * A rating of reported violent crime around the address, per resident rather
 * than per block, so a dense neighbourhood is not graded down for holding more
 * people. The wording stays comparative on purpose: police reports measure
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
        `were filed within ${safety.radiusMeters}m of this address in the last 12 months, among ` +
        `${safety.residents.toLocaleString()} residents in that radius: ` +
        `${safety.ratePer100k.toLocaleString()} per 100,000 residents per year, against ` +
        `${safety.cityRatePer100k.toLocaleString()} citywide. That rate is lower than ` +
        `${safety.quieterThanPercent}% of populated San Francisco blocks. ` +
        'Sources: DataSF police incident reports, 2020 census block population. ' +
        'Reports are not convictions, and a grade describes the area, not this building.'
      }
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
        style={{ backgroundColor: color, color: '#0b1220' }}
      >
        {safety.grade}
      </span>
      {summary(safety)}
    </span>
  );
}
