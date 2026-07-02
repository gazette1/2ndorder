import type { Candidate, ChainNode, Layer } from '../types';

const LAYER_ORDER: Layer[] = ['enabler', 'picks_and_shovels', 'second_order', 'disrupted'];

const LAYER_LABELS: Record<Layer, string> = {
  enabler: 'Enablers',
  picks_and_shovels: 'Picks and shovels',
  second_order: 'Second-order adopters',
  disrupted: 'Disrupted',
};

interface Props {
  chain: ChainNode[];
  candidates: Candidate[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

export function ChainBoard({ chain, candidates, selectedNodeId, onSelectNode }: Props) {
  const inBandCount = (nodeId: string) =>
    candidates.filter((c) => c.nodeId === nodeId && c.status !== 'filtered_out').length;

  return (
    <section className="section">
      <h2 className="section-title">Adoption chain</h2>
      <p className="section-note">
        Click a node to filter the candidate table to names mapped to it. Click again to clear.
      </p>
      <div className="chain-grid">
        {LAYER_ORDER.map((layer) => (
          <div key={layer} className="chain-col">
            <div className={`chain-col-head layer-${layer}`}>{LAYER_LABELS[layer]}</div>
            {chain
              .filter((n) => n.layer === layer)
              .map((node) => {
                const count = inBandCount(node.id);
                const selected = selectedNodeId === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={selected ? 'node-card node-selected' : 'node-card'}
                    onClick={() => onSelectNode(selected ? null : node.id)}
                  >
                    <div className="node-name">{node.name}</div>
                    <div className="node-logic">{node.logic}</div>
                    <div className="node-count">
                      {count} in-band candidate{count === 1 ? '' : 's'}
                    </div>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
