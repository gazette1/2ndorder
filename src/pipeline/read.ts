import { docUrl, fetchDocText, submissions } from '../lib/edgar.js';
import { llm } from '../lib/llm.js';
import { load, save, saveText } from '../lib/store.js';
import { readPrompt } from '../prompts/read.js';
import { selectReadTargets } from './targets.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { Candidate, Decomposition, Dossier, ModelSubscores, Quote, Read } from '../types.js';

// Sentences from the hit filing that touch the theme, exact text preserved for citation.
function excerpt(text: string, keywords: string[], meta: Omit<Quote, 'text'>): Quote[] {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  const kw = keywords.map((k) => k.toLowerCase());
  const quotes: Quote[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const t = s.trim();
    if (t.length < 60 || t.length > 700) continue;
    if (!kw.some((k) => t.toLowerCase().includes(k))) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    quotes.push({ text: t, ...meta });
    if (quotes.length >= 20) break;
  }
  return quotes;
}

export async function readFilings(slug: string): Promise<Read[]> {
  const { seed } = load<{ seed: string }>(slug, 'run');
  const decomp = load<Decomposition>(slug, 'decompose');
  const candidates = load<Candidate[]>(slug, 'candidates');
  const dossiers = load<Dossier[]>(slug, 'dossiers');
  const targets = selectReadTargets(candidates);

  const reads: Read[] = [];
  for (const c of targets) {
    const node = decomp.nodes.find((n) => n.id === c.nodeId)!;

    // Catalyst-density raw input: 8-K cadence over the last 12 months.
    const subs = await submissions(c.cik);
    const yearAgo = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
    const eightKCount12m = subs.recent.form.filter(
      (f, i) => f === '8-K' && subs.recent.filingDate[i] >= yearAgo,
    ).length;

    const text = await fetchDocText(c.cik, c.latestHit.accession, c.latestHit.docId);
    const quotes = excerpt(text, [...decomp.themeKeywords, ...node.searchPhrases], {
      form: c.latestHit.form,
      accession: c.latestHit.accession,
      filedAt: c.latestHit.filedAt,
      url: docUrl(c.cik, c.latestHit.accession, c.latestHit.docId),
    });
    if (!quotes.length) {
      console.warn(`[read] ${c.ticker}: no theme excerpts in ${c.latestHit.accession}, skipping`);
      continue;
    }
    // Excerpts persist even when the model call fails, so fixtures can be
    // authored (and any output audited) against the exact filing sentences.
    saveText(slug, `excerpts/${c.ticker}.json`, JSON.stringify(quotes, null, 2));

    const dossier = dossiers.find((d) => d.ticker === c.ticker);
    const prompt = readPrompt({
      seed,
      node,
      ticker: c.ticker,
      companyName: c.name,
      eightKCount12m,
      rubricDefinitions: rubric.definitions,
      excerpts: quotes,
      dossier,
    });
    try {
      const raw = await llm(slug, `read-${c.ticker}`, prompt, 'json');
      const parsed = JSON.parse(raw) as { exposure: Read['exposure']; subscores: ModelSubscores; namedCustomers?: string[] };
      reads.push({ ticker: c.ticker, cik: c.cik, eightKCount12m, quotes, exposure: parsed.exposure, subscores: parsed.subscores });
      // Named enterprise customers the model found in the filing feed the customer graph.
      if (dossier && parsed.namedCustomers?.length) {
        dossier.customers.namedCustomers = parsed.namedCustomers;
      }
      console.log(`[read] ${c.ticker}: ${quotes.length} excerpts, exposure ${parsed.exposure}`);
    } catch (e) {
      console.warn(`[read] ${c.ticker}: ${(e as Error).message}`);
    }
  }
  if (reads.length < targets.length) {
    console.warn(`[read] ${targets.length - reads.length} of ${targets.length} reads incomplete, see warnings above`);
  }

  save(slug, 'reads', reads);
  save(slug, 'dossiers', dossiers); // may now carry model-found named customers
  return reads;
}
