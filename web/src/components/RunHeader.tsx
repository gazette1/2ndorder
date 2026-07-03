import type { RunPayload } from '../types';
import { fmtBand, fmtDateLong, fmtDateShort } from '../format';

export function RunHeader({ run }: { run: RunPayload['run'] }) {
  return (
    <header className="run-header">
      <div className="run-kicker">Adoption Chain</div>
      <h1 className="run-seed">{run.seed}</h1>
      <div className="run-meta">
        <span>Run {fmtDateLong(run.createdAt)}</span>
        <span className="meta-sep">|</span>
        <span>{fmtBand(run.capBandMM)}</span>
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
