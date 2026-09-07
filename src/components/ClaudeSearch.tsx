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
  if (plan.maxRentPerBedroom > 0) parts.push(`≤ $${plan.maxRentPerBedroom.toLocaleString()}/bedroom`);
  if (plan.bedrooms.length) {
    parts.push(plan.bedrooms.map((beds) => (beds === 0 ? 'studio' : `${beds}bd`)).join('/'));
  }
  if (plan.bathsPerBedroom > 0) parts.push('a bathroom per bedroom');
  else if (plan.minBathrooms > 0) parts.push(`${plan.minBathrooms}+ ba`);
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
  const [history, setHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || pending) return;

    setPending(true);
    setError(null);
    setResult(null);
    try {
      const answer = await api.claudeSearch(trimmed, history);
      setResult(answer);
      setQuestion('');
      setHistory((turns) => [...turns, { question: trimmed, answer: answer.answer }].slice(-3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claude could not answer that.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span
          className="flex items-center justify-center w-9 h-9 rounded-xl text-white shrink-0"
          style={{ backgroundColor: 'var(--accent)' }}
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2z" />
            <path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity="0.7" />
          </svg>
        </span>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Ask Claude
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)' }}>
            {history.length > 0
              ? 'Ask a follow-up in plain English — Claude remembers the last few questions.'
              : 'Chat in plain English. Claude reads every listing we have, ranks the deals and flags the sketchy ones.'}
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          {history.map((turn) => (
            <div key={turn.question} className="flex justify-end">
              <p
                className="text-sm rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[80%] text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {turn.question}
              </p>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="e.g. 2br under $4,500 walkable to Caltrain, nothing sketchy"
          maxLength={500}
          className="flex-1 rounded-full px-5 py-3 text-base border outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 3}
          className="px-6 py-3 rounded-full text-base font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {pending ? 'Thinking…' : history.length > 0 ? 'Ask' : 'Ask Claude'}
        </button>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setHistory([]);
              setResult(null);
            }}
            className="pill"
          >
            Start over
          </button>
        )}
      </form>

      {history.length === 0 && !result && !pending && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuestion(suggestion);
                void submit(suggestion);
              }}
              className="pill"
              style={{ color: 'var(--text-dim)' }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {pending && (
        <p className="text-sm animate-pulse" style={{ color: 'var(--text-dim)' }}>
          Claude is reading every listing — this can take up to a minute.
        </p>
      )}

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
            className="text-base whitespace-pre-wrap leading-relaxed rounded-xl px-4 py-3"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
          >
            {result.answer}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {result.matched} listing{result.matched === 1 ? '' : 's'} matched · {planSummary(result.plan)}
            {result.relaxed.length > 0 && ` · ignored ${result.relaxed.join(' and ')} to find these`}
          </p>
          {result.ranked.map((pick) => (
            <Pick key={pick.listing.key} pick={pick} />
          ))}
        </div>
      )}
    </div>
  );
}
