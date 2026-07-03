import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from '../lib/edgar.js';
import { llm } from '../lib/llm.js';
import { load } from '../lib/store.js';
import { cardPrompt } from './prompts.js';
import { extractSections } from './sections.js';
import type { CompanyCard } from './card.js';
import type { Candidate } from '../types.js';

// Hermes ingest: read filings once, write a card per company to data/corpus/.
// Usage:
//   npm run hermes -- pilot <runSlug> <n>   card the top n in-band names of an existing run
//   npm run hermes -- company <cik> <ticker>
// The full-band backfill is the same loop over a band-wide CIK list; it is held
// behind an explicit command on purpose (about $22 on flash, see docs/DESIGN.md).

const CORPUS = path.resolve('data/corpus');

function saveCard(card: CompanyCard) {
  fs.mkdirSync(path.join(CORPUS, 'cards'), { recursive: true });
  fs.writeFileSync(path.join(CORPUS, 'cards', `${card.ticker}.json`), JSON.stringify(card, null, 2));
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

const [cmd, a, b] = process.argv.slice(2);

if (cmd === 'pilot') {
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
  console.error('usage: npm run hermes -- pilot <runSlug> <n> | company <cik> <ticker>');
  process.exit(1);
}
