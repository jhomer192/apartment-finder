import type { SearchSource } from '../types';

interface Props {
  source: SearchSource;
  url: string;
  metroName: string;
}

export function SourceCard({ source, url, metroName }: Props) {
  return (
    <div
      className="rounded-xl border overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="p-5 flex flex-col h-full">
        {/* Source header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: source.color }}
          >
            {source.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              {source.name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {metroName}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm mb-4 flex-1" style={{ color: 'var(--text-dim)' }}>
          {source.description}
        </p>

        {/* CTA button */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center font-medium py-2.5 px-4 rounded-lg transition-all text-sm"
          style={{
            backgroundColor: source.color,
            color: '#ffffff',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Search {source.name}
          <svg className="inline-block w-4 h-4 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
