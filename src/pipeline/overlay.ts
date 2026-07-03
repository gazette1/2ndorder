import { latestHoldings, overlayPositions, resolveFundCik, summarize } from '../lib/thirteenf.js';
import { load, save } from '../lib/store.js';
import type { Candidate, Decomposition, Overlay } from '../types.js';

// Place a fund's 13F holdings on the run's consequence map.
export async function overlay(slug: string, fundQuery: string): Promise<Overlay> {
  const { nodes } = load<Decomposition>(slug, 'decompose');
  const candidates = load<Candidate[]>(slug, 'candidates');

  const fund = await resolveFundCik(fundQuery);
  const { filedAt, positions } = await latestHoldings(fund.cik);
  const placed = overlayPositions(positions, candidates, nodes);
  const result = summarize({ name: fund.name, cik: fund.cik, filedAt }, placed);

  save(slug, 'overlay', result);
  console.log(
    `[overlay] ${fund.name}: ${result.summary.matched} of ${result.summary.totalPositions} positions matched ` +
      `(${result.summary.onBeneficiary} beneficiary, ${result.summary.onAtRisk} at risk)`,
  );
  return result;
}
