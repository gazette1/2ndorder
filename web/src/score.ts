import type { Read, SubScore } from './types';

// Composite = sum(weight * subscore.score) / (5 * sum(weights)) * 100, gated by
// exposure, rounded. Must stay in parity with src/pipeline/score.ts in the engine:
// a peripheral name cannot outrank a direct one on side dimensions alone.
export function compositeScore(
  read: Read,
  weights: Record<string, number>,
  exposureGate?: Record<string, number>,
): number {
  let weighted = 0;
  let sumW = 0;
  const subs = read.subscores as unknown as Record<string, SubScore>;
  for (const key of Object.keys(weights)) {
    const sub = subs[key];
    if (!sub) continue;
    weighted += weights[key] * sub.score;
    sumW += weights[key];
  }
  if (sumW === 0) return 0;
  const gate = exposureGate?.[read.exposure] ?? 1;
  return Math.round((weighted / (5 * sumW)) * 100 * gate);
}

export type ScoreBand = 'Strong' | 'Moderate' | 'Weak' | 'Insufficient evidence';

// Band label for a 0-100 composite. The UI leads with the band; the numeric
// composite stays visible as a tooltip and in the subscore detail.
export function scoreBand(score: number): ScoreBand {
  if (score >= 50) return 'Strong';
  if (score >= 30) return 'Moderate';
  if (score >= 15) return 'Weak';
  return 'Insufficient evidence';
}
