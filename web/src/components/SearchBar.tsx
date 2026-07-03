import { useState, type FormEvent } from 'react';
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
          placeholder="Search a thesis, theme, or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="search-btn" disabled={busy || !query.trim()}>
          Run
        </button>
      </form>

      {statusNote && <p className="search-status">{statusNote}</p>}
      {message && <p className="search-message">{message}</p>}

      {runs.length > 0 && (
        <div className="search-runs">
          <span className="search-runs-label">Existing runs:</span>
          {runs.map((r) => (
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
