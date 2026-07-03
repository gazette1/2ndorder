import { CONFIG } from '../config.js';
import { load, save } from '../lib/store.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { Dossier, Read, SubScore } from '../types.js';

const T = CONFIG.scoreThresholds;

// Deterministic 0-to-5 from Form 4 open-market activity. Stated as a ladder a PM
// can see and move by editing config thresholds.
function insiderConviction(d: Dossier): SubScore {
  const { netBuyUSD, buyCount, sellCount, distinctBuyers } = d.insider;
  const usd = `net $${netBuyUSD.toLocaleString()} over ${buyCount} buys and ${sellCount} sales by ${distinctBuyers} insider(s), trailing 12 months`;
  let score: number;
  if (netBuyUSD >= T.insiderClusterUSD && distinctBuyers >= 2) score = 5;
  else if (netBuyUSD >= T.insiderClusterUSD) score = 4;
  else if (netBuyUSD >= T.insiderBuyUSD) score = 3;
  else if (netBuyUSD > 0) score = 2;
  else if (buyCount === 0 && sellCount === 0) score = 2; // no open-market signal is neutral, not bearish
  else if (netBuyUSD <= -T.insiderClusterUSD) score = 0;
  else score = 1;
  return { score, rationale: `Form 4: ${usd}.`, quoteIdx: [] };
}

// Deterministic 0-to-5 from the customer graph: government award dollars, named
// enterprise customers, and how many other filers name the company.
function customerValidation(d: Dossier): SubScore {
  const { govAwardTotalUSD, namedCustomers, reverseCiteCount } = d.customers;
  const facts = `gov awards $${govAwardTotalUSD.toLocaleString()}, ${namedCustomers.length} named customer(s), ${reverseCiteCount} other filers name the company`;
  let score: number;
  if (govAwardTotalUSD >= T.govAwardMaterialUSD || (namedCustomers.length >= 1 && reverseCiteCount >= 3)) score = 5;
  else if (govAwardTotalUSD > 0 || namedCustomers.length >= 1) score = 4;
  else if (reverseCiteCount >= 5) score = 3;
  else if (reverseCiteCount >= 1) score = 2;
  else score = 1;
  return { score, rationale: `Customer graph: ${facts}.`, quoteIdx: [] };
}

// Composite over all rubric weights, normalized so the scale stays 0 to 100
// regardless of how many dimensions are weighted or how a PM re-weights them,
// then gated by exposure: a peripheral name cannot outrank a direct one on
// side dimensions alone. Multipliers live in rubric.json, arguable like weights.
export function composite(read: Read): number {
  let weighted = 0;
  let sumW = 0;
  for (const [key, weight] of Object.entries(rubric.weights)) {
    const sub = (read.subscores as any)[key] as SubScore | undefined;
    if (!sub) continue;
    weighted += weight * sub.score;
    sumW += weight;
  }
  if (sumW === 0) return 0;
  const gate = (rubric.exposureGate as any)[read.exposure] ?? 1;
  return Math.round((weighted / (5 * sumW)) * 100 * gate);
}

export async function score(slug: string): Promise<Record<string, number>> {
  const reads = load<Read[]>(slug, 'reads');
  const dossiers = load<Dossier[]>(slug, 'dossiers');

  const scores: Record<string, number> = {};
  for (const r of reads) {
    const d = dossiers.find((x) => x.ticker === r.ticker);
    if (d) {
      r.subscores.insiderConviction = insiderConviction(d);
      r.subscores.customerValidation = customerValidation(d);
    }
    scores[r.ticker] = composite(r);
  }

  // Persist the merged six-dimension subscores so the read object the UI receives
  // matches the composite it recomputes.
  save(slug, 'reads', reads);
  save(slug, 'scores', scores);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  console.log(`[score] ${ranked.map(([t, s]) => `${t} ${s}`).join(', ')}`);
  return scores;
}
