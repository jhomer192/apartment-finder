import type { SearchResult } from '../types';
import { SourceCard } from './SourceCard';

interface Props {
  results: SearchResult[];
}

export function SourcesGrid({ results }: Props) {
  return (
    <div className="space-y-8">
      {results.map(result => (
        <div key={result.metroId}>
          {results.length > 1 && (
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {result.metroName}
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.sources.map(({ source, url }) => (
              <SourceCard
                key={`${result.metroId}-${source.id}`}
                source={source}
                url={url}
                metroName={result.metroName}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
