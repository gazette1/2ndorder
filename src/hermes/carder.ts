import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from '../lib/edgar.js';
import { llm } from '../lib/llm.js';
import { cardPrompt } from './prompts.js';
import { extractProspectusSections, extractSections } from './sections.js';
import { cardFilename } from './card.js';
import type { CompanyCard } from './card.js';

// Card one company from its latest 10-K. Side-effect-free module (no CLI code)
// so both the ingest CLI and the API server can import it: the server uses it
// for on-demand carding when a user looks up a ticker the corpus missed.

const CORPUS = path.resolve('data/corpus');

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
  // Annual report first (10-K, or 20-F for foreign private issuers). A recent
  // IPO has neither yet; its S-1/S-11 prospectus carries the same three
  // sections under named headings, often more candidly.
  let idx = r.form.findIndex((f) => f === '10-K' || f === '20-F');
  let sourceForm: string = idx > -1 ? r.form[idx] : '';
  if (idx === -1) {
    idx = r.form.findIndex((f) => f === 'S-1' || f === 'S-1/A' || f === 'S-11' || f === 'S-11/A');
    sourceForm = idx > -1 ? r.form[idx] : '';
  }
  if (idx === -1) {
    console.warn(`[hermes] ${ticker}: no 10-K, 20-F, or S-1 in recent filings, skipping`);
    return null;
  }
  const isProspectus = sourceForm.startsWith('S-1');
  const accession = r.accessionNumber[idx];
  const doc = r.primaryDocument[idx];
  const text = await fetchDocText(cik, accession, doc);
  const sections = isProspectus ? extractProspectusSections(text) : extractSections(text);
  const found = [sections.business, sections.riskFactors, sections.mdna].filter(Boolean).length;
  if (!found) {
    console.warn(`[hermes] ${ticker}: no sections extracted from ${sourceForm} ${accession}, skipping`);
    return null;
  }

  const raw = await llm('hermes', `card-${ticker}`, cardPrompt({ ticker, name, sections }), 'json', 'light');
  const parsed = JSON.parse(raw);
  const card: CompanyCard = {
    cik,
    ticker,
    name,
    source: { form: sourceForm, accession, filedAt: r.filingDate[idx], url: docUrl(cik, accession, doc) },
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
