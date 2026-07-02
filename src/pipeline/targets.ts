import { CONFIG } from '../config.js';
import type { Candidate } from '../types.js';

// Shared target selection so enrich and read operate on the same names.
// Take the strongest in-band name per chain node first, so the set spans layers
// (an enabler, a second-order adopter, a disrupted name) instead of clustering
// on whichever node produced the most hits. Fill remaining slots by hit count.
export function selectReadTargets(candidates: Candidate[]): Candidate[] {
  const inBand = candidates.filter((c) => c.status === 'in_band');
  const targets: Candidate[] = [];
  const usedNodes = new Set<string>();
  for (const c of inBand) {
    if (targets.length >= CONFIG.topKReads) break;
    if (usedNodes.has(c.nodeId)) continue;
    usedNodes.add(c.nodeId);
    targets.push(c);
  }
  for (const c of inBand) {
    if (targets.length >= CONFIG.topKReads) break;
    if (!targets.includes(c)) targets.push(c);
  }
  return targets;
}
