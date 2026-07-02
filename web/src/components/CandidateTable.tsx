import type { Candidate, ChainNode, Read } from '../types';
import { fmtFloatMM } from '../format';

export interface CandidateRow {
  candidate: Candidate;
  read: Read | null;
  score: number | null;
  hasThesis: boolean;
}

interface Props {
  rows: CandidateRow[];
  chain: ChainNode[];
  selectedTicker: string | null;
  selectedNodeId: string | null;
  onClearNode: () => void;
  onSelectRow: (ticker: string) => void;
}

export function CandidateTable({
  rows,
  chain,
  selectedTicker,
  selectedNodeId,
  onClearNode,
  onSelectRow,
}: Props) {
  const nodeName = (id: string) => chain.find((n) => n.id === id)?.name ?? id;
  const filterNode = selectedNodeId ? chain.find((n) => n.id === selectedNodeId) : null;

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
      <table className="cand-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Chain node</th>
            <th className="num">Float</th>
            <th className="num">FTS hits</th>
            <th>Exposure</th>
            <th className="num">Composite</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-cell">
                No candidates match the current filter.
              </td>
            </tr>
          )}
          {rows.map(({ candidate: c, read, score, hasThesis }) => {
            const filtered = c.status === 'filtered_out';
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
                <td className="num">{fmtFloatMM(c.publicFloatMM)}</td>
                <td className="num">{c.ftsHits}</td>
                <td>{read ? read.exposure : ''}</td>
                <td className="num score-cell">{score !== null ? score : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="table-footnote">
        Scored names rank by composite under the current weights. Unscored in-band names follow by
        full-text search hits. Filtered names appear last with the reason they fell out of band.
        Rows with a drafted thesis open on click.
      </p>
    </section>
  );
}
