import type { Read, SubScore } from './types';

// Composite = sum(weight * subscore.score) / (5 * sum(weights)) * 100, rounded.
// Subscores are on a 0 to 5 scale, so the composite lands on 0 to 100.
export function compositeScore(read: Read, weights: Record<string, number>): number {
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
  return Math.round((weighted / (5 * sumW)) * 100);
}
