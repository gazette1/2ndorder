import type { RunPayload } from '../types';
import { CAP_PROVENANCE_NOTE, fmtBand, fmtDateLong, fmtDateShort } from '../format';

// Link label for an article-sourced run: the article title when the server
// extracted one, otherwise the article's hostname.
function sourceLabel(url: string, title: string | null): string {
  if (title) return title;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function RunHeader({ run }: { run: RunPayload['run'] }) {
  return (
    <header className="run-header">
      <div className="run-kicker">Corollary run</div>
      <h1 className="run-seed">{run.seed}</h1>
      {run.sourceUrl && (
        <div className="run-source mono">
          From article:{' '}
          <a href={run.sourceUrl} target="_blank" rel="noreferrer">
            {sourceLabel(run.sourceUrl, run.sourceTitle)}
          </a>
        </div>
      )}
      <div className="run-meta">
        <span>Run {fmtDateLong(run.createdAt)}</span>
        <span className="meta-sep">|</span>
        <span className="cap-band" title={CAP_PROVENANCE_NOTE}>
          {fmtBand(run.capBandMM)}{' '}
          <span className="cap-band-note">(delayed price x reported shares)</span>
        </span>
        <span className="meta-sep">|</span>
        <span>Run id {run.id}</span>
        {run.mode === 'fixture' && (
          <span className="mode-badge" title="Model outputs from authored fixtures, not a live pipeline run">
            fixture
          </span>
        )}
        {run.asof && <span className="hdr-badge">Filings as of {fmtDateShort(run.asof)}</span>}
        {run.counterOf && <span className="hdr-badge">Counter-scenario of {run.counterOf}</span>}
      </div>
      {run.mode === 'fixture' && (
        <div className="mode-note">Model outputs from authored fixtures.</div>
      )}
    </header>
  );
}
