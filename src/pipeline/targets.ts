import { CONFIG } from '../config.js';
import type { Candidate, ChainNode } from '../types.js';

// Read-target selection is where "under-covered" either gets enforced or stays a
// slogan. Raw FTS hit count rewards big, talkative filers (a covered utility beats
// a $300MM component maker every time), so selection scores evidence per unit of
// size: ftsHits / sqrt(floatMM). A $200MM name with 5 hits outranks a $4,800MM
// name with 20. Deterministic and arguable, like the rubric.
function selectionScore(c: Candidate): number {
  const cap = Math.max(c.marketCapMM ?? CONFIG.capBandMM[1], 1);
  return c.ftsHits / Math.sqrt(cap);
}

// Take the strongest name per node first (so the read set spans the map), fill
// remaining slots by selection score, and reserve a quarter of the slots for
// names on at_risk nodes so the short side of the map gets read, not just drawn.
export function selectReadTargets(candidates: Candidate[], nodes?: ChainNode[]): Candidate[] {
  const k = CONFIG.topKReads;
  const inBand = [...candidates.filter((c) => c.status === 'in_band')].sort(
    (a, b) => selectionScore(b) - selectionScore(a),
  );

  const atRiskNodes = new Set((nodes ?? []).filter((n) => n.polarity === 'at_risk').map((n) => n.id));
  const targets: Candidate[] = [];
  const usedNodes = new Set<string>();

  // Pass 1: best name per node, in selection-score order.
  for (const c of inBand) {
    if (targets.length >= k) break;
    if (usedNodes.has(c.nodeId)) continue;
    usedNodes.add(c.nodeId);
    targets.push(c);
  }

  // Pass 2: guarantee the short side at least a quarter of the slots.
  if (atRiskNodes.size) {
    const wantAtRisk = Math.ceil(k / 4);
    let haveAtRisk = targets.filter((c) => atRiskNodes.has(c.nodeId)).length;
    for (const c of inBand) {
      if (haveAtRisk >= wantAtRisk || targets.length >= k) break;
      if (targets.includes(c) || !atRiskNodes.has(c.nodeId)) continue;
      targets.push(c);
      haveAtRisk++;
    }
  }

  // Pass 3: fill remaining slots by selection score.
  for (const c of inBand) {
    if (targets.length >= k) break;
    if (!targets.includes(c)) targets.push(c);
  }
  return targets;
}
