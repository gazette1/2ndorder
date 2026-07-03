import type { Candidate, ChainNode, Dossier, Read } from '../types';
import { fmtCapMM, fmtUSD } from '../format';

export interface CandidateRow {
  candidate: Candidate;
  read: Read | null;
  score: number | null;
  hasThesis: boolean;
  dossier: Dossier | null;
}

interface Props {
  longRows: CandidateRow[];
  shortRows: CandidateRow[];
  chain: ChainNode[];
  selectedTicker: string | null;
  selectedNodeId: string | null;
  onClearNode: () => void;
  onSelectRow: (ticker: string) => void;
}

export function CandidateTable({
  longRows,
  shortRows,
  chain,
  selectedTicker,
  selectedNodeId,
  onClearNode,
  onSelectRow,
}: Props) {
  const nodeName = (id: string) => chain.find((n) => n.id === id)?.name ?? id;
  const filterNode = selectedNodeId ? chain.find((n) => n.id === selectedNodeId) : null;

  const renderTable = (rows: CandidateRow[]) => (
    <table className="cand-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Company</th>
          <th>Node</th>
          <th className="num">Mkt cap</th>
          <th className="num">FTS hits</th>
          <th>Exposure</th>
          <th className="num">Insider / Gov</th>
          <th className="num">Composite</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={8} className="empty-cell">
              No candidates in this section under the current filter.
            </td>
          </tr>
        )}
        {rows.map(({ candidate: c, read, score, hasThesis, dossier }) => {
          const filtered = c.status === 'filtered_out';
          const realityFlags = dossier?.reality?.flags ?? [];
          const cls = [
            filtered ? 'row-filtered' : '',
            hasThesis ? 'row-clickable' : '',
            selectedTicker === c.ticker ? 'row-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <tr
              key={c.ticker + c.cik}
              className={cls}
              onClick={hasThesis ? () => onSelectRow(c.ticker) : undefined}
            >
              <td className="mono">{c.ticker}</td>
              <td>
                {c.name}
                {filtered && c.filterReason && (
                  <span className="filter-reason">{c.filterReason}</span>
                )}
              </td>
              <td>{nodeName(c.nodeId)}</td>
              <td className="num">{fmtCapMM(c.marketCapMM)}</td>
              <td className="num">{c.ftsHits}</td>
              <td>{read ? read.exposure : ''}</td>
              <td className="num dossier-cell">
                {dossier ? (
                  <span className="dossier-marks">
                    <span
                      className={
                        dossier.insider.netBuyUSD > 0
                          ? 'ins-mark mono is-buy'
                          : dossier.insider.netBuyUSD < 0
                            ? 'ins-mark mono is-sell'
                            : 'ins-mark mono'
                      }
                      title="Net open-market insider dollars, trailing 12 months"
                    >
                      {fmtUSD(dossier.insider.netBuyUSD)}
                    </span>
                    <span className="gov-mark mono" title="Government award total">
                      {dossier.customers.govAwardTotalUSD > 0
                        ? `gov ${fmtUSD(dossier.customers.govAwardTotalUSD)}`
                        : 'no gov'}
                    </span>
                    {realityFlags.length > 0 && (
                      <span className="flag-mark mono" title={realityFlags.join('; ')}>
                        {realityFlags.length} {realityFlags.length === 1 ? 'flag' : 'flags'}
                      </span>
                    )}
                  </span>
                ) : (
                  ''
                )}
              </td>
              <td className="num score-cell">{score !== null ? score : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <section className="section">
      <h2 className="section-title">Candidates</h2>
      {filterNode && (
        <p className="section-note">
          Filtered to node: {filterNode.name}.{' '}
          <button type="button" className="link-btn" onClick={onClearNode}>
            Clear filter
          </button>
        </p>
      )}
      <h3 className="cand-subhead">Long candidates</h3>
      {renderTable(longRows)}
      <h3 className="cand-subhead cand-subhead-short">Short side, names on at-risk nodes</h3>
      <p className="cand-subhead-note">
        High scores here are conviction on the risk, not buy signals.
      </p>
      {renderTable(shortRows)}
      <p className="table-footnote">
        Scored names rank by composite under the current weights. Unscored in-band names follow by
        full-text search hits. Filtered names appear last with the reason they fell out of band.
        Rows with a drafted thesis open on click.
      </p>
    </section>
  );
}
