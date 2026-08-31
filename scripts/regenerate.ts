// Regenerate generated text across all demo runs after the K/M/B formatting
// change: re-derive reality checks (fund-scale basis and flag strings),
// redraft every thesis under the new style rule, rebuild every memo, and
// refresh the static fallback payload. Deterministic parts run first; model
// calls (thesis drafts) run last so a model failure leaves reality and memos
// already consistent.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';
import { load, save } from '../src/lib/store.js';
import { advUSD } from '../src/lib/marketdata.js';
import { fmtUSD } from '../src/lib/money.js';
import { debtUSD, operatingCashFlowUSD, sharesHistory, submissions } from '../src/lib/edgar.js';
import { draftTheses } from '../src/pipeline/draft.js';
import { writeMemo } from '../src/pipeline/memo.js';
import { buildPayload } from '../src/pipeline/payload.js';
import type { Candidate, Dossier } from '../src/types.js';

const RUNS = path.resolve('data/runs');
const slugs = fs
  .readdirSync(RUNS)
  .filter((d) => d !== 'hermes' && fs.existsSync(path.join(RUNS, d, 'theses.json')));

console.log('runs to regenerate:', slugs.join(', '));

// Re-derive the reality check for one dossier from fresh deterministic data,
// using the same logic as enrich (kept in sync by npm run verify's flag lint).
async function rederiveReality(c: Candidate, d: Dossier) {
  const R = CONFIG.reality;
  const [adv, hist, debt, cfo, subs] = await Promise.all([
    advUSD(c.ticker),
    sharesHistory(c.cik),
    debtUSD(c.cik),
    operatingCashFlowUSD(c.cik),
    submissions(c.cik),
  ]);
  const funds = d.fundamentals;
  const daysToBuild = adv ? Math.ceil(R.positionUSD / (adv * R.participationRate)) : null;
  const ownershipPct =
    c.marketCapMM && c.marketCapMM > 0 ? Math.round((R.positionUSD / (c.marketCapMM * 1e6)) * 1000) / 10 : null;
  const netCashUSD = funds.cashUSD !== null ? funds.cashUSD - (debt ?? 0) : null;
  const burnPerQuarter = cfo !== null && cfo < 0 ? -cfo / 4 : null;
  const runwayQuarters =
    burnPerQuarter && funds.cashUSD !== null ? Math.round((funds.cashUSD / burnPerQuarter) * 10) / 10 : null;
  const sharesChangePct = hist?.yearAgo
    ? Math.round(((hist.latest - hist.yearAgo) / hist.yearAgo) * 1000) / 10
    : null;
  const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
  const r = subs.recent;
  const shelfOnFile = r.form.some(
    (f, i) => (f === 'S-3' || f === 'S-3/A' || f === '424B5') && r.filingDate[i] >= yearAgo,
  );
  const flags: string[] = [];
  if (daysToBuild !== null && daysToBuild > R.thinLiquidityDays) {
    flags.push(
      `thin liquidity: about ${daysToBuild} trading days to build ${fmtUSD(R.positionUSD)} at ${Math.round(R.participationRate * 100)} percent of volume`,
    );
  }
  if (runwayQuarters !== null && runwayQuarters < R.minRunwayQuarters) {
    flags.push(`cash runway about ${runwayQuarters} quarters at the current operating burn`);
  }
  if (sharesChangePct !== null && sharesChangePct > R.dilutionFlagPct) {
    flags.push(`share count up ${sharesChangePct} percent in 12 months`);
  }
  if (shelfOnFile) flags.push('shelf registration on file (S-3 or 424B5, trailing 12 months)');
  if (ownershipPct !== null && ownershipPct > R.ownershipFlagPct) {
    flags.push(
      `position would be ${ownershipPct} percent of the company (${R.positionBasis}); not investable at this fund scale without a smaller position or a bigger company`,
    );
  }
  d.reality = {
    advUSD: adv,
    daysToBuild,
    positionUSD: R.positionUSD,
    positionBasis: R.positionBasis,
    ownershipPct,
    netCashUSD,
    runwayQuarters,
    sharesChangePct,
    shelfOnFile,
    flags,
    provenance: ['yahoo', 'sec_xbrl'],
  };
}

for (const slug of slugs) {
  console.log(`=== ${slug}: reality re-derive ===`);
  const candidates = load<Candidate[]>(slug, 'candidates');
  const dossiers = load<Dossier[]>(slug, 'dossiers');
  for (const d of dossiers) {
    const c = candidates.find((x) => x.ticker === d.ticker);
    if (!c) continue;
    try {
      await rederiveReality(c, d);
      console.log(`  ${d.ticker}: pos ${fmtUSD(d.reality!.positionUSD!)} own ${d.reality!.ownershipPct}% flags ${d.reality!.flags.length}`);
    } catch (e) {
      console.log(`  ${d.ticker}: reality re-derive failed, keeping stored (${String((e as Error).message).slice(0, 60)})`);
    }
  }
  save(slug, 'dossiers', dossiers);
}

for (const slug of slugs) {
  console.log(`=== ${slug}: redraft theses ===`);
  await draftTheses(slug);
  writeMemo(slug);
}

// Static fallback: the bundled payload the app uses when the API is offline.
const fallback = buildPayload('grid-capex');
fs.writeFileSync(path.resolve('web/public/data/latest.json'), JSON.stringify(fallback));
console.log('static fallback regenerated from grid-capex');
console.log('REGENERATION DONE');
