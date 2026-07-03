import fs from 'node:fs';
import path from 'node:path';
import { fullTextSearch, fundamentals, insiderSummary } from '../lib/edgar.js';
import { coverage } from '../lib/coverage.js';
import { cleanName, emptyCustomerGraph, govAwards } from '../lib/usaspending.js';
import { load, save } from '../lib/store.js';
import { CONFIG } from '../config.js';
import { selectReadTargets } from './targets.js';
import type { Candidate, Coverage, Dossier, ReverseCite } from '../types.js';

// Coverage needs a key. When none is set, load an authored fixture so the feature
// is demonstrable, and leave its provenance as stub so the UI marks it not live.
function coverageFixture(slug: string, ticker: string): Coverage | null {
  const p = path.resolve('fixtures', slug, `coverage-${ticker}.json`);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, 'utf8')) as Coverage) : null;
}

// Who else names this company in their filings. A distinct filer naming the
// company is weak evidence of a real commercial relationship (customer, supplier,
// partner). Self-references are dropped.
async function reverseCites(cik: string, name: string): Promise<ReverseCite[]> {
  const enddt = new Date().toISOString().slice(0, 10);
  const startdt = new Date(Date.now() - CONFIG.ftsYears * 365 * 86400_000).toISOString().slice(0, 10);
  let hits;
  try {
    // Search the company name without its corporate suffix, so other filers who
    // write "Kelly Services" (not "KELLY SERVICES INC") still match.
    hits = await fullTextSearch(cleanName(name), startdt, enddt);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: ReverseCite[] = [];
  for (const h of hits) {
    if (h.cik === cik || seen.has(h.cik)) continue;
    seen.add(h.cik);
    out.push({ cik: h.cik, name: h.companyName, form: h.hit.form, filedAt: h.hit.filedAt });
  }
  return out;
}

export async function enrich(slug: string): Promise<Dossier[]> {
  const candidates = load<Candidate[]>(slug, 'candidates');
  const targets = selectReadTargets(candidates);

  const dossiers: Dossier[] = [];
  for (const c of targets) {
    const [insider, funds, awards, cites, live] = await Promise.all([
      insiderSummary(c.cik),
      fundamentals(c.cik),
      govAwards(c.name).catch(() => ({ awards: [], totalUSD: 0 })),
      reverseCites(c.cik, c.name),
      coverage(c.ticker).catch(() => ({ analystCount: null, consensusRating: null, priceTargetMeanUSD: null, ratingActions: [], provenance: 'stub' as const })),
    ]);
    // Fall back to an authored coverage fixture when the live source is stubbed.
    const cov = live.provenance === 'stub' ? coverageFixture(slug, c.ticker) ?? live : live;

    const customers = emptyCustomerGraph();
    customers.govAwards = awards.awards;
    customers.govAwardTotalUSD = awards.totalUSD;
    customers.reverseCites = cites;
    customers.reverseCiteCount = cites.length;

    dossiers.push({ ticker: c.ticker, cik: c.cik, insider, fundamentals: funds, customers, coverage: cov });
    console.log(
      `[enrich] ${c.ticker}: insider net $${insider.netBuyUSD.toLocaleString()} (${insider.buyCount}B/${insider.sellCount}S), ` +
        `gov $${awards.totalUSD.toLocaleString()} over ${awards.awards.length} awards, ${cites.length} reverse-cites, ` +
        `coverage ${cov.analystCount ?? 'stub'}${cov.ratingActions.length ? ` (${cov.ratingActions.length} actions)` : ''}`,
    );
  }

  save(slug, 'dossiers', dossiers);
  return dossiers;
}
