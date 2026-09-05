import type { SourceStatus } from '../api/types';

interface Props {
  sources: SourceStatus[];
}

function describe(source: SourceStatus): { color: string; text: string } {
  if (!source.enabled) return { color: '#64748b', text: 'off' };
  if (source.error) return { color: '#ef4444', text: 'unavailable' };
  return { color: '#22c55e', text: `${source.count} live` };
}

export function SourceStatusBar({ sources }: Props) {
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
      <span className="font-medium" style={{ color: 'var(--text)' }}>
        Sources:
      </span>
      {sources.map((source) => {
        const status = describe(source);
        return (
          <span key={source.id} className="flex items-center gap-1.5" title={source.error ?? undefined}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: status.color }} />
            {source.name} · {status.text}
          </span>
        );
      })}
    </div>
  );
}
