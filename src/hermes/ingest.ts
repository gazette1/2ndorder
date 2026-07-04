import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { tickerMap } from '../lib/edgar.js';
import { getSpentUSD } from '../lib/llm.js';
import { load } from '../lib/store.js';
import { loadUniverse, scanUniverse } from './universe.js';
import { cardCompany } from './carder.js';
import { cardFilename } from './card.js';
import type { Candidate } from '../types.js';

// Hermes ingest: read filings once, write a card per company to data/corpus/.
// Usage:
//   npm run hermes -- universe                 scan every SEC ticker, keep those inside
//                                               the market cap band (network only, free,
//                                               resumable, run this before a full backfill)
//   npm run hermes -- backfill [budgetUSD]      card the market-cap-banded universe
//                                               (data/corpus/universe.json if it exists,
//                                               else names discovered across local runs)
//   npm run hermes -- backfill-all [budgetUSD]  card EVERY US-listed SEC filer regardless
//                                               of market cap (about 8,000 CIKs; funds and
//                                               shells without a 10-K are skipped). Runs 4
//                                               workers concurrently; stops at the budget
//                                               (real spend from the API's own token usage).
//                                               Resumable: carded tickers are skipped.
//   npm run hermes -- pilot <runSlug> <n>       card the top n in-band names of an existing run
//   npm run hermes -- company <cik> <ticker>

const CORPUS = path.resolve('data/corpus');

// Every unique in-band candidate across every local run, deduped by CIK. Zero
// network cost to build: it only reads what map/enrich already wrote to disk.
function discoveredUniverse(): { cik: string; ticker: string; name: string }[] {
  const runsDir = path.resolve('data/runs');
  if (!fs.existsSync(runsDir)) return [];
  const byCik = new Map<string, { cik: string; ticker: string; name: string }>();
  for (const slug of fs.readdirSync(runsDir)) {
    const p = path.join(runsDir, slug, 'candidates.json');
    if (!fs.existsSync(p)) continue;
    try {
      const candidates = JSON.parse(fs.readFileSync(p, 'utf8')) as Candidate[];
      for (const c of candidates) {
        if (c.status === 'in_band' && !byCik.has(c.cik)) {
          byCik.set(c.cik, { cik: c.cik, ticker: c.ticker, name: c.name });
        }
      }
    } catch {
      continue;
    }
  }
  return [...byCik.values()];
}

function alreadyCarded(ticker: string): boolean {
  return fs.existsSync(path.join(CORPUS, 'cards', cardFilename(ticker)));
}

const [cmd, a, b] = process.argv.slice(2);

if (cmd === 'universe') {
  await scanUniverse();
} else if (cmd === 'backfill-all') {
  // Every US-listed SEC filer, all caps, concurrent workers, budget-guarded.
  const budget = Number(a ?? 40);
  const tickers = await tickerMap();
  const queue = [...tickers.entries()]
    .map(([cik, v]) => ({ cik, ticker: v.ticker, name: v.title }))
    .filter((c) => !alreadyCarded(c.ticker));
  console.log(
    `[hermes] backfill-all: ${queue.length} uncarded filers of ${tickers.size} total. ` +
      `Budget $${budget.toFixed(2)}, 4 workers (provider=${CONFIG.llm.provider}).`,
  );
  let carded = 0;
  let skipped = 0;
  let stopped = false;
  async function worker() {
    for (;;) {
      if (stopped) return;
      if (getSpentUSD() >= budget) {
        if (!stopped) {
          stopped = true;
          console.log(`[hermes] backfill-all: budget reached ($${getSpentUSD().toFixed(2)}), stopping workers.`);
        }
        return;
      }
      const c = queue.shift();
      if (!c) return;
      try {
        const card = await cardCompany(c.cik, c.ticker, c.name);
        if (card) carded++;
        else skipped++;
      } catch (e) {
        console.warn(`[hermes] ${c.ticker}: ${(e as Error).message}`);
        skipped++;
      }
      const done = carded + skipped;
      if (done % 100 === 0) {
        console.log(`[hermes] backfill-all progress: ${done} processed (${carded} carded), $${getSpentUSD().toFixed(2)} spent, ${queue.length} queued`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`[hermes] backfill-all done: ${carded} carded, ${skipped} skipped, $${getSpentUSD().toFixed(2)} spent of $${budget.toFixed(2)}.`);
} else if (cmd === 'backfill') {
  const budget = Number(a ?? 7);
  const full = loadUniverse();
  const source = full ?? discoveredUniverse();
  const universe = source.filter((c) => !alreadyCarded(c.ticker));
  console.log(
    `[hermes] backfill: ${universe.length} names to card, from ${full ? 'the full market-cap-banded universe' : 'names discovered across local runs (no universe.json yet; run `npm run hermes -- universe` first for full coverage)'}. ` +
      `Budget $${budget.toFixed(2)} (provider=${CONFIG.llm.provider}).`,
  );
  let carded = 0;
  let skipped = 0;
  for (const c of universe) {
    if (getSpentUSD() >= budget) {
      const remaining = universe.length - carded - skipped;
      const avgCost = carded > 0 ? getSpentUSD() / carded : null;
      const projected = avgCost !== null ? `about $${(avgCost * remaining).toFixed(2)} more needed` : 'cost unknown until at least one card completes';
      console.log(
        `[hermes] backfill: budget reached ($${getSpentUSD().toFixed(3)} spent of $${budget.toFixed(2)}), ` +
          `${remaining} names left uncarded (${projected}). Rerun this command after topping up to continue.`,
      );
      break;
    }
    try {
      const card = await cardCompany(c.cik, c.ticker, c.name);
      if (card) carded++;
      else skipped++;
    } catch (e) {
      console.warn(`[hermes] ${c.ticker}: ${(e as Error).message}`);
      skipped++;
    }
    if ((carded + skipped) % 50 === 0) {
      console.log(`[hermes] backfill progress: ${carded + skipped}/${universe.length} processed, $${getSpentUSD().toFixed(3)} spent`);
    }
  }
  console.log(
    `[hermes] backfill done: ${carded} cards written, ${skipped} skipped, ` +
      `$${getSpentUSD().toFixed(3)} spent of $${budget.toFixed(2)} budget.`,
  );
} else if (cmd === 'pilot') {
  const slug = a ?? 'grid-capex';
  const n = Number(b ?? 3);
  const candidates = load<Candidate[]>(slug, 'candidates').filter((c) => c.status === 'in_band').slice(0, n);
  console.log(`[hermes] pilot: carding ${candidates.length} names from run "${slug}" (provider=${CONFIG.llm.provider})`);
  for (const c of candidates) {
    try {
      await cardCompany(c.cik, c.ticker, c.name);
    } catch (e) {
      console.warn(`[hermes] ${c.ticker}: ${(e as Error).message}`);
    }
  }
} else if (cmd === 'company') {
  if (!a || !b) {
    console.error('usage: npm run hermes -- company <cik> <ticker>');
    process.exit(1);
  }
  await cardCompany(a.padStart(10, '0'), b, b);
} else {
  console.error('usage: npm run hermes -- universe | backfill [budgetUSD] | backfill-all [budgetUSD] | pilot <runSlug> <n> | company <cik> <ticker>');
  process.exit(1);
}
