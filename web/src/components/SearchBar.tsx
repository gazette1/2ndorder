import { useMemo, useState, type FormEvent } from 'react';
import type { RunSummary } from '../api';

interface Props {
  onRun: (query: string) => void;
  runs: RunSummary[];
  onPickRun: (runId: string) => void;
  busy: boolean;
  statusNote: string | null;
  message: string | null;
}

export function SearchBar({ onRun, runs, onPickRun, busy, statusNote, message }: Props) {
  const [query, setQuery] = useState('');

  // Existing-run chips: one chip per unique seed (the newest run wins),
  // ordered newest first.
  const chips = useMemo(() => {
    const bySeed = new Map<string, RunSummary>();
    for (const r of runs) {
      const cur = bySeed.get(r.seed);
      if (!cur || r.createdAt > cur.createdAt) bySeed.set(r.seed, r);
    }
    return [...bySeed.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [runs]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || busy) return;
    onRun(query.trim());
  };

  return (
    <section className="search-front">
      <form className="search-bar" onSubmit={submit}>
        <input
          className="search-input"
          type="text"
          placeholder="Enter a scenario, thesis, or theme, or paste an article link"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="search-btn" disabled={busy || !query.trim()}>
          Run
        </button>
      </form>

      {!query && (
        <p className="search-caption">
          An article link runs both the scenario it implies and the counter-scenario.
        </p>
      )}

      {statusNote && <p className="search-status">{statusNote}</p>}
      {message && <p className="search-message">{message}</p>}

      {chips.length > 0 && (
        <div className="search-runs">
          <span className="search-runs-label">Existing runs:</span>
          {chips.map((r) => (
            <button
              key={r.id}
              type="button"
              className="run-chip"
              onClick={() => onPickRun(r.id)}
              disabled={busy}
              title={r.seed}
            >
              {r.seed}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
