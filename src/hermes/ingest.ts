import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from '../lib/edgar.js';
import { getSpentUSD, llm } from '../lib/llm.js';
import { load } from '../lib/store.js';
import { cardPrompt } from './prompts.js';
import { extractSections } from './sections.js';
import { loadUniverse, scanUniverse } from './universe.js';
import type { CompanyCard } from './card.js';
import type { Candidate } from '../types.js';

// Hermes ingest: read filings once, write a card per company to data/corpus/.
// Usage:
//   npm run hermes -- universe               scan every SEC ticker, keep those inside
//                                             the market cap band (network only, free,
//                                             resumable, run this before a full backfill)
//   npm run hermes -- backfill [budgetUSD]    card the universe (data/corpus/universe.json
//                                             if it exists, else names discovered across
//                                             local runs), stopping once real spend (from
//                                             the API's own token usage) reaches budgetUSD.
//                                             Resumable: already-carded tickers are skipped.
//   npm run hermes -- pilot <runSlug> <n>     card the top n in-band names of an existing run
//   npm run hermes -- company <cik> <ticker>

const CORPUS = path.resolve('data/corpus');

// Windows reserves CON, PRN, AUX, NUL, COM1-9, LPT1-9 (case-insensitive, any
// extension). A ticker that collides (CON) yields a file git cannot even open
// on Windows and aborts staging, so sanitize the filename. The index key stays
// the real ticker; only the on-disk name is prefixed.
const RESERVED = new Set(
  ['CON', 'PRN', 'AUX', 'NUL']
    .concat(Array.from({ length: 9 }, (_, i) => 'COM' + (i + 1)))
    .concat(Array.from({ length: 9 }, (_, i) => 'LPT' + (i + 1))),
);
export function cardFilename(ticker: string): string {
  return (RESERVED.has(ticker.toUpperCase()) ? '_' + ticker : ticker) + '.json';
}

function saveCard(card: CompanyCard) {
  fs.mkdirSync(path.join(CORPUS, 'cards'), { recursive: true });
  fs.writeFileSync(path.join(CORPUS, 'cards', cardFilename(card.ticker)), JSON.stringify(card, null, 2));
  const indexPath = path.join(CORPUS, 'index.json');
  const index: Record<string, { name: string; filedAt: string; tags: string[]; generatedAt: string }> = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : {};
  index[card.ticker] = {
    name: card.name,
    filedAt: card.source.filedAt,
    tags: [...new Set(card.exposures.map((e) => e.tag))],
    generatedAt: card.generatedAt,
  };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

export async function cardCompany(cik: string, ticker: string, name: string): Promise<CompanyCard | null> {
  const subs = await submissions(cik);
  const r = subs.recent;
  const idx = r.form.findIndex((f) => f === '10-K');
  if (idx === -1) {
    console.warn(`[hermes] ${ticker}: no 10-K in recent filings, skipping`);
    return null;
  }
  const accession = r.accessionNumber[idx];
  const doc = r.primaryDocument[idx];
  const text = await fetchDocText(cik, accession, doc);
  const sections = extractSections(text);
  const found = [sections.business, sections.riskFactors, sections.mdna].filter(Boolean).length;
  if (!found) {
    console.warn(`[hermes] ${ticker}: no sections extracted from ${accession}, skipping`);
    return null;
  }

  const raw = await llm('hermes', `card-${ticker}`, cardPrompt({ ticker, name, sections }), 'json', 'light');
  const parsed = JSON.parse(raw);
  const card: CompanyCard = {
    cik,
    ticker,
    name,
    source: { form: '10-K', accession, filedAt: r.filingDate[idx], url: docUrl(cik, accession, doc) },
    business: String(parsed.business ?? ''),
    sellsTo: parsed.sellsTo ?? [],
    namedCustomers: parsed.namedCustomers ?? [],
    namedSuppliers: parsed.namedSuppliers ?? [],
    exposures: (parsed.exposures ?? []).filter((e: any) => e?.tag && e?.sentence),
    catalysts: (parsed.catalysts ?? []).filter((c: any) => c?.sentence),
    tamClaims: (parsed.tamClaims ?? []).filter((t: any) => t?.sentence),
    generatedAt: new Date().toISOString(),
    model: CONFIG.llm.models.light,
  };
  saveCard(card);
  console.log(
    `[hermes] ${ticker}: ${found}/3 sections, ${card.exposures.length} exposures ` +
      `(${card.exposures.filter((e) => e.stance === 'core_product').length} core), ` +
      `${card.catalysts.length} catalysts, ${card.tamClaims.length} TAM claims`,
  );
  return card;
}

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
  console.error('usage: npm run hermes -- universe | backfill [budgetUSD] | pilot <runSlug> <n> | company <cik> <ticker>');
  process.exit(1);
}
