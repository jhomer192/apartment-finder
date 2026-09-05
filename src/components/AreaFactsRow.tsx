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
  const busier =
    incidents && incidents.cityMedian > 0
      ? incidents.count > incidents.cityMedian
        ? 'busier than the typical SF block'
        : 'quieter than the typical SF block'
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
          title={`Police incident reports filed within ${incidents.radiusMeters}m in the last 12 months — ${busier ?? 'no citywide comparison available'}. Reports are not convictions. Source: DataSF. Citywide median for the same radius: ${incidents.cityMedian}.`}
        >
          {incidents.count.toLocaleString()} reported incidents within {incidents.radiusMeters}m/yr
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
