import fs from 'node:fs';
import path from 'node:path';
import { debtUSD, fullTextSearch, fundamentals, insiderSummary, operatingCashFlowUSD, sharesHistory, submissions } from '../lib/edgar.js';
import { advUSD } from '../lib/marketdata.js';
import { coverage } from '../lib/coverage.js';
import { cleanName, emptyCustomerGraph, govAwards } from '../lib/usaspending.js';
import { load, save } from '../lib/store.js';
import { CONFIG } from '../config.js';
import { selectReadTargets } from './targets.js';
import type { Candidate, Coverage, Decomposition, Dossier, Fundamentals, RealityCheck, ReverseCite } from '../types.js';

// The SMID reality check: tradability, survivability, dilution. Deterministic,
// keyless, and every threshold is a config assumption a PM can argue with.
async function realityCheck(c: Candidate, funds: Fundamentals): Promise<RealityCheck> {
  const R = CONFIG.reality;
  const [adv, hist, debt, cfo, subs] = await Promise.all([
    advUSD(c.ticker),
    sharesHistory(c.cik),
    debtUSD(c.cik),
    operatingCashFlowUSD(c.cik),
    submissions(c.cik),
  ]);

  const daysToBuild = adv ? Math.ceil(R.positionUSD / (adv * R.participationRate)) : null;
  const netCashUSD = funds.cashUSD !== null ? funds.cashUSD - (debt ?? 0) : null;
  const burnPerQuarter = cfo !== null && cfo < 0 ? -cfo / 4 : null;
  const runwayQuarters =
    burnPerQuarter && funds.cashUSD !== null ? Math.round((funds.cashUSD / burnPerQuarter) * 10) / 10 : null;
  const sharesChangePct =
    hist?.yearAgo ? Math.round(((hist.latest - hist.yearAgo) / hist.yearAgo) * 1000) / 10 : null;

  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const r = subs.recent;
  const shelfOnFile = r.form.some(
    (f, i) => (f === 'S-3' || f === 'S-3/A' || f === '424B5') && r.filingDate[i] >= yearAgo,
  );

  const flags: string[] = [];
  if (daysToBuild !== null && daysToBuild > R.thinLiquidityDays) {
    flags.push(
      `thin liquidity: about ${daysToBuild} trading days to build $${R.positionUSD / 1e6}MM at ${Math.round(R.participationRate * 100)} percent of volume`,
    );
  }
  if (runwayQuarters !== null && runwayQuarters < R.minRunwayQuarters) {
    flags.push(`cash runway about ${runwayQuarters} quarters at the current operating burn`);
  }
  if (sharesChangePct !== null && sharesChangePct > R.dilutionFlagPct) {
    flags.push(`share count up ${sharesChangePct} percent in 12 months`);
  }
  if (shelfOnFile) flags.push('shelf registration on file (S-3 or 424B5, trailing 12 months)');

  return { advUSD: adv, daysToBuild, netCashUSD, runwayQuarters, sharesChangePct, shelfOnFile, flags, provenance: ['yahoo', 'sec_xbrl'] };
}

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
  const { nodes } = load<Decomposition>(slug, 'decompose');
  const targets = selectReadTargets(candidates, nodes);

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

    const reality = await realityCheck(c, funds);

    dossiers.push({ ticker: c.ticker, cik: c.cik, insider, fundamentals: funds, customers, coverage: cov, reality });
    console.log(
      `[enrich] ${c.ticker}: insider net $${insider.netBuyUSD.toLocaleString()} (${insider.buyCount}B/${insider.sellCount}S), ` +
        `gov $${awards.totalUSD.toLocaleString()} over ${awards.awards.length} awards, ${cites.length} reverse-cites, ` +
        `coverage ${cov.analystCount ?? 'stub'}${cov.ratingActions.length ? ` (${cov.ratingActions.length} actions)` : ''}, ` +
        `reality ${reality.flags.length ? reality.flags.length + ' flag(s)' : 'clean'}`,
    );
  }

  save(slug, 'dossiers', dossiers);
  return dossiers;
}
