import type { MacroContext, RunPayload } from '../types';
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

// Macro series values are index levels, rates, and prices on mixed scales, so
// they render as plain numbers, at most two decimals.
function fmtMacroValue(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Year-over-year change stays neutral gray: a favorable sign is not
// determinable across mixed series (a rising unemployment rate is not a
// rising gas price).
function fmtYoy(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% y/y`;
}

export function RunHeader({
  run,
  macro,
}: {
  run: RunPayload['run'];
  macro?: MacroContext | null;
}) {
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
      {macro && macro.series.length > 0 && (
        <div className="macro-strip">
          <div className="macro-items">
            {macro.series.map((s) => (
              <span
                key={s.id}
                className="macro-item"
                title={`${s.id}, as of ${fmtDateShort(s.asof)}`}
              >
                <span className="macro-label">{s.label}</span>
                <span className="macro-value mono">{fmtMacroValue(s.latest)}</span>
                {s.yoyPct !== null && (
                  <span className="macro-yoy mono">{fmtYoy(s.yoyPct)}</span>
                )}
              </span>
            ))}
          </div>
          {macro.note && <p className="macro-note">{macro.note}</p>}
        </div>
      )}
    </header>
  );
}
