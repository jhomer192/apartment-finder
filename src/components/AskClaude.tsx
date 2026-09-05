import { useState } from 'react';
import * as api from '../api/client';

interface Props {
  listingKeys: string[];
}

const SUGGESTIONS = [
  'Which of these look like the best value?',
  'Any red flags I should worry about?',
  'Which ones are closest to downtown?',
];

export function AskClaude({ listingKeys }: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || pending) return;

    setPending(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await api.askClaude(trimmed, listingKeys.slice(0, 20));
      setAnswer(result.answer);
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
          Answers use the {listingKeys.length} listing{listingKeys.length === 1 ? '' : 's'} currently on screen.
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
          placeholder="Which listing is the best deal?"
          className="flex-1 rounded-lg px-3 py-2 text-sm border outline-none"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 3}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {pending ? 'Thinking…' : 'Ask'}
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

      {answer && (
        <p
          className="text-sm whitespace-pre-wrap leading-relaxed rounded-lg px-3 py-2"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
        >
          {answer}
        </p>
      )}
    </div>
  );
}
