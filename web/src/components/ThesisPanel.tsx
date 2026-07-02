import { useMemo, useState } from 'react';
import type { Dossier, Read, SubScore, Thesis } from '../types';
import { fmtDateShort } from '../format';
import { blockContainsCite, parseBlocks, renderInline } from '../markdown';
import { labelForKey } from './RubricPanel';
import { DossierPanel } from './DossierPanel';

interface Props {
  thesis: Thesis;
  read: Read | null;
  dossier: Dossier | null;
  weights: Record<string, number>;
  composite: number | null;
  onClose: () => void;
}

export function ThesisPanel({ thesis, read, dossier, weights, composite, onClose }: Props) {
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const blocks = useMemo(() => parseBlocks(thesis.markdown), [thesis.markdown]);

  const toggleCite = (n: number) => setActiveCite((cur) => (cur === n ? null : n));

  const quoteBox = (n: number) => {
    const q = read?.quotes[n];
    if (!q) {
      return (
        <div className="quote-box" key={`q${n}`}>
          <div className="quote-meta">Citation [{n}]: quote not found in this read.</div>
        </div>
      );
    }
    return (
      <div className="quote-box" key={`q${n}`}>
        <blockquote className="quote-text">{q.text}</blockquote>
        <div className="quote-meta">
          {q.form}, filed {fmtDateShort(q.filedAt)}, accession {q.accession}.{' '}
          <a href={q.url} target="_blank" rel="noopener noreferrer">
            View source document at SEC
          </a>
        </div>
      </div>
    );
  };

  const subs = read ? (read.subscores as unknown as Record<string, SubScore>) : null;

  return (
    <aside className="thesis-panel">
      <div className="thesis-head">
        <div>
          <div className="thesis-ticker mono">{thesis.ticker}</div>
          {composite !== null && (
            <div className="thesis-score">Composite {composite} under current weights</div>
          )}
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Close thesis">
          Close
        </button>
      </div>

      {dossier && <DossierPanel dossier={dossier} />}

      <div className="thesis-body">
        {blocks.map((block, bi) => {
          const key = `blk${bi}`;
          let el;
          if (block.kind === 'h1') {
            el = <h1 key={key}>{renderInline(block.text, key, toggleCite, activeCite)}</h1>;
          } else if (block.kind === 'h2') {
            el = <h2 key={key}>{renderInline(block.text, key, toggleCite, activeCite)}</h2>;
          } else if (block.kind === 'ul') {
            el = (
              <ul key={key}>
                {(block.items ?? []).map((item, li) => (
                  <li key={`${key}-li${li}`}>
                    {renderInline(item, `${key}-li${li}`, toggleCite, activeCite)}
                  </li>
                ))}
              </ul>
            );
          } else {
            el = <p key={key}>{renderInline(block.text, key, toggleCite, activeCite)}</p>;
          }
          const showQuote = blockContainsCite(block, activeCite);
          return showQuote && activeCite !== null ? (
            <div key={`${key}-wrap`}>
              {el}
              {quoteBox(activeCite)}
            </div>
          ) : (
            el
          );
        })}
      </div>

      {subs && (
        <div className="subscore-block">
          <h3 className="subscore-title">Score breakdown</h3>
          <table className="subscore-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th className="num">Score</th>
                <th className="num">Weight</th>
                <th>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(subs).map((key) => (
                <tr key={key}>
                  <td>{labelForKey(key)}</td>
                  <td className="num">{subs[key].score} / 5</td>
                  <td className="num">{(weights[key] ?? 0).toFixed(2)}</td>
                  <td className="rationale-cell">{subs[key].rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
}
