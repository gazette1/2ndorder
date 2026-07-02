import { load, save } from '../lib/store.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { Read } from '../types.js';

// Deterministic weighted composite, 0 to 100. The model judges subscores against
// filing evidence; the arithmetic and the weights stay outside the model so a PM
// can argue with each weight and re-rank without a rerun.
export function composite(read: Read): number {
  let total = 0;
  for (const [key, weight] of Object.entries(rubric.weights)) {
    total += weight * (read.subscores as any)[key].score;
  }
  return Math.round((total / 5) * 100);
}

export async function score(slug: string): Promise<Record<string, number>> {
  const reads = load<Read[]>(slug, 'reads');
  const scores: Record<string, number> = {};
  for (const r of reads) scores[r.ticker] = composite(r);
  save(slug, 'scores', scores);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  console.log(`[score] ${ranked.map(([t, s]) => `${t} ${s}`).join(', ')}`);
  return scores;
}
