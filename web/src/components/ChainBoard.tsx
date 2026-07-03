// Consequence map: the centerpiece of the results view. A fixed scenario root
// card, then one column per consequence order (1st, 2nd, 3rd...). Nodes are
// polarity-tinted cards; clicking one selects it and filters the candidate
// table. Parent linkage is textual ("follows from") in the detail strip below
// the map rather than drawn edges.

import type { Candidate, ChainNode } from '../types';

function ordinalLabel(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th order`;
  const last = n % 10;
  if (last === 1) return `${n}st order`;
  if (last === 2) return `${n}nd order`;
  if (last === 3) return `${n}rd order`;
  return `${n}th order`;
}

const HORIZON_LABELS: Record<ChainNode['horizon'], string> = {
  near: 'near',
  mid: 'mid',
  long: 'long',
};

interface MapProps {
  seed: string;
  chain: ChainNode[];
  candidates: Candidate[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export function ConsequenceMap({ seed, chain, candidates, selectedNodeId, onSelectNode }: MapProps) {
  const orders = [...new Set(chain.map((n) => n.order))].sort((a, b) => a - b);

  const nameCount = (nodeId: string) =>
    candidates.filter((c) => c.nodeId === nodeId && c.status !== 'filtered_out').length;

  return (
    <section className="section">
      <h2 className="section-title">Consequence map</h2>
      <p className="section-note">
        Click a node to see its logic and filter the candidate table. Click again to clear.
      </p>
      <div className="map-scroll">
        <div
          className="map-grid"
          style={{ gridTemplateColumns: `150px repeat(${orders.length}, minmax(230px, 1fr))` }}
        >
          <div className="map-col">
            <div className="map-col-head">Scenario</div>
            <div className="node-card node-root">
              <div className="node-name">{seed}</div>
            </div>
          </div>
          {orders.map((order) => (
            <div key={order} className="map-col">
              <div className="map-col-head">{ordinalLabel(order)}</div>
              {chain
                .filter((n) => n.order === order)
                .map((node) => {
                  const selected = selectedNodeId === node.id;
                  const k = nameCount(node.id);
                  const cls = [
                    'node-card',
                    node.polarity === 'at_risk' ? 'node-at-risk' : 'node-beneficiary',
                    node.whiteSpace ? 'node-white-space' : '',
                    selected ? 'node-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={cls}
                      onClick={() => onSelectNode(selected ? null : node.id)}
                    >
                      <div className="node-card-top">
                        <span className="node-name">{node.name}</span>
                        {node.whiteSpace && <span className="node-tag">white space</span>}
                      </div>
                      <div className="node-mech">{node.mechanism || node.logic}</div>
                      <div className="node-foot">
                        <span className="node-counts mono">
                          {k} name{k === 1 ? '' : 's'}, {node.filingHits ?? 0} filing
                          {(node.filingHits ?? 0) === 1 ? '' : 's'}
                        </span>
                        <span className="node-horizon">{HORIZON_LABELS[node.horizon]}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface DetailProps {
  node: ChainNode;
  parent: ChainNode | null;
  drilling: boolean;
  drillNote: string | null;
  onDrill: (nodeId: string) => void;
}

export function NodeDetailStrip({ node, parent, drilling, drillNote, onDrill }: DetailProps) {
  const polarityLabel = node.polarity === 'at_risk' ? 'at risk' : 'beneficiary';
  const polarityCls =
    node.polarity === 'at_risk' ? 'detail-polarity is-at-risk' : 'detail-polarity is-beneficiary';
  return (
    <section className="node-detail">
      <div className="node-detail-head">
        <span className="node-detail-name">{node.name}</span>
        <span className={polarityCls}>{polarityLabel}</span>
        <span className="node-detail-follows">
          follows from: {parent ? parent.name : 'scenario'}
        </span>
        <button
          type="button"
          className="btn-secondary node-drill-btn"
          onClick={() => onDrill(node.id)}
          disabled={drilling}
        >
          {drilling ? 'Drilling...' : 'Drill deeper'}
        </button>
      </div>
      <p className="node-detail-logic">{node.logic}</p>
      {drillNote && <p className="action-note">{drillNote}</p>}
    </section>
  );
}
