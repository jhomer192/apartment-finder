import type { AreaFacts } from '../types';

interface Props {
  area: AreaFacts | null;
}

const pillStyle = {
  backgroundColor: 'color-mix(in srgb, var(--text-dim) 10%, transparent)',
  color: 'var(--text-dim)',
};

/**
 * Public civic data about the block, stated as counts with their radius and
 * source. It deliberately stops short of grading a neighbourhood: there is no
 * "safe" or "unsafe" here, only what the city reported near this address.
 */
export function AreaFactsRow({ area }: Props) {
  if (!area || (!area.transit && !area.incidents && !area.parking)) return null;

  const { transit, incidents, parking } = area;
  // Per resident, not per block: a downtown block with 400 flats reports more
  // of everything than a quiet street simply by holding more people.
  const versusCity =
    incidents && incidents.cityRatePer100k > 0
      ? `${(incidents.ratePer100k / incidents.cityRatePer100k).toFixed(1)}× the citywide rate of ${incidents.cityRatePer100k.toLocaleString()}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      {transit && (
        <span
          className="px-1.5 py-0.5 rounded"
          style={pillStyle}
          title={`Straight-line distance to ${transit.name} (${transit.kind}) is ${transit.meters}m; any walking time is an estimate from that line, not a routed walk. Stops from OpenStreetMap.`}
        >
          {transit.walkMinutes === null
            ? `Nearest train ${(transit.meters / 1000).toFixed(1)} km away: ${transit.name}`
            : `${transit.walkMinutes} min walk to ${transit.name} (${transit.kind})`}
        </span>
      )}
      {incidents && (
        <span
          className="px-1.5 py-0.5 rounded"
          style={pillStyle}
          title={`${incidents.count.toLocaleString()} police incident reports filed within ${incidents.radiusMeters}m in the last 12 months, among ${incidents.residents.toLocaleString()} residents in that radius${versusCity ? ` — ${versusCity}` : ''}. All report types, so a commercial strip counts shoplifting from people who live elsewhere. Reports are not convictions. Sources: DataSF, 2020 census.`}
        >
          {incidents.ratePer100k.toLocaleString()} reports/100k residents per yr
        </span>
      )}
      {parking && (
        <span
          className="px-1.5 py-0.5 rounded"
          style={pillStyle}
          title={`SFMTA metered spaces within ${parking.radiusMeters}m. More meters means kerb space here is paid and contested; it says nothing about permit or garage parking.`}
        >
          {parking.meteredSpaces === 0
            ? 'No metered parking within 250m'
            : `${parking.meteredSpaces.toLocaleString()} metered spaces within ${parking.radiusMeters}m`}
        </span>
      )}
    </div>
  );
}
