interface Props {
  minutes: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
  method: 'google_maps' | 'haversine';
}

const colorClasses: Record<string, string> = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function CommuteBadge({ minutes, color, method }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colorClasses[color]}`}
      title={`Estimated commute: ${minutes} min (${method === 'google_maps' ? 'Google Maps' : 'straight-line estimate'})`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {minutes} min
    </span>
  );
}
