import type { Rubric } from '../types';

const KEY_LABELS: Record<string, string> = {
  optionality: 'Optionality',
  revenueToOpportunity: 'Revenue to opportunity',
  catalystDensity: 'Catalyst density',
  managementConviction: 'Management conviction',
  insiderConviction: 'Insider conviction',
  customerValidation: 'Customer validation',
};

export function labelForKey(key: string): string {
  return KEY_LABELS[key] ?? key;
}

interface Props {
  rubric: Rubric;
  weights: Record<string, number>;
  onChange: (key: string, value: number) => void;
  onReset: () => void;
}

export function RubricPanel({ rubric, weights, onChange, onReset }: Props) {
  const houseMax = Math.max(...Object.values(rubric.weights), 0.5);
  const sliderMax = houseMax * 2;

  return (
    <section className="section">
      <h2 className="section-title">Argue with the weights</h2>
      <p className="section-note">
        Move a weight and the composite scores and ranking above update in place. Nothing reruns,
        the underlying subscores and quotes are fixed for this run.
      </p>
      <div className="rubric-grid">
        {Object.keys(rubric.weights).map((key) => (
          <div key={key} className="rubric-row">
            <div className="rubric-head">
              <span className="rubric-label">{labelForKey(key)}</span>
              <span className="rubric-value mono">{weights[key].toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={0.05}
              value={weights[key]}
              onChange={(e) => onChange(key, parseFloat(e.target.value))}
              aria-label={`Weight for ${labelForKey(key)}`}
            />
            <p className="rubric-def">{rubric.definitions[key] ?? ''}</p>
          </div>
        ))}
      </div>
      <button type="button" className="reset-btn" onClick={onReset}>
        Reset to house weights
      </button>
    </section>
  );
}
