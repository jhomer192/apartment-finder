import type { SearchSource } from '../types';

interface Props {
  sources: Array<{ source: SearchSource; url: string }>;
}

export function SourceLinksBar({ sources }: Props) {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-dim)' }}>
        Search more on:
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map(({ source, url }) => (
          <a
            key={source.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
            style={{
              backgroundColor: source.color,
              color: '#fff',
            }}
          >
            {source.name}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
