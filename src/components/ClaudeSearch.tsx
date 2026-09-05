import { useState } from 'react';
import * as api from '../api/client';
import type { ClaudeSearchResult, RankedListing, SearchPlan } from '../api/types';
import { useShortlist } from '../hooks/useShortlist';

const SUGGESTIONS = [
  '2br under $4,500 near BART, nothing sketchy',
  'Best value places for five people',
  'Cheap listings that are probably too good to be true',
];

const VERDICT_COLORS: Record<RankedListing['verdict'], string> = {
  'great deal': '#22c55e',
  fair: '#0ea5e9',
  overpriced: '#f97316',
  'scam risk': '#ef4444',
};

function planSummary(plan: SearchPlan): string {
  const parts: string[] = [];
  if (plan.minRent > 0 || plan.maxRent < 100_000) {
    parts.push(`$${plan.minRent.toLocaleString()}–$${plan.maxRent.toLocaleString()}`);
  }
  if (plan.bedrooms.length) {
    parts.push(plan.bedrooms.map((beds) => (beds === 0 ? 'studio' : `${beds}bd`)).join('/'));
  }
  if (plan.neighborhoods.length) parts.push(plan.neighborhoods.join(', '));
  if (plan.keywords.length) parts.push(plan.keywords.join(', '));
  if (plan.maxScamScore < 100) parts.push(`scam risk ≤ ${plan.maxScamScore}`);
  parts.push(`sorted by ${plan.sort}`);
  return parts.join(' · ');
}

function Pick({ pick }: { pick: RankedListing }) {
  const { keys, toggle } = useShortlist();
  const saved = keys.has(pick.listing.key);
  const color = VERDICT_COLORS[pick.verdict];

  return (
    <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {pick.verdict}
        </span>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          ${pick.listing.price.toLocaleString()}/mo
        </span>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {pick.listing.bedrooms ?? '?'}bd · {pick.listing.neighborhood} ·{' '}
          {pick.valueDelta === 0
            ? 'at the median'
            : `${Math.abs(pick.valueDelta)}% ${pick.valueDelta > 0 ? 'below' : 'above'} median`}
        </span>
        <button
          onClick={() => void toggle(pick.listing.key)}
          className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: saved ? '#ef4444' : 'var(--text-dim)' }}
        >
          {saved ? 'Shortlisted' : 'Shortlist'}
        </button>
        <a
          href={pick.listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          Open
        </a>
      </div>
      <p className="text-xs" style={{ color: 'var(--text)' }}>
        {pick.listing.title}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
        {pick.why}
      </p>
    </div>
  );
}

/** Claude searches every listing we hold, not just what the filters pulled up. */
export function ClaudeSearch() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ClaudeSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || pending) return;

    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.claudeSearch(trimmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claude could not answer that.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-4"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div>
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
          Ask Claude
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
          Describe what you want; Claude searches every listing we have and ranks the deals.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="2br under $4,500 walkable to Caltrain, no scams"
          maxLength={500}
          className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 3}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {pending ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuestion(suggestion);
              void submit(suggestion);
            }}
            className="text-[11px] px-2.5 py-1 rounded-full border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
        >
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <p
            className="text-sm whitespace-pre-wrap leading-relaxed rounded-lg px-3 py-2"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            {result.answer}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {result.matched} listing{result.matched === 1 ? '' : 's'} matched · {planSummary(result.plan)}
          </p>
          {result.ranked.map((pick) => (
            <Pick key={pick.listing.key} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}
