import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from './edgar.js';
import { llm } from './llm.js';
import type { Governance } from '../types.js';

// The proxy statement (DEF 14A) carries what the 10-K does not: pay structure,
// related-party dealings, and live shareholder proposals. Proxies run hundreds
// of pages, so pull targeted excerpts around the three anchors and let the
// light model extract, rather than reading the whole document.
function excerptAround(text: string, anchors: RegExp[], radius: number): string | null {
  for (const a of anchors) {
    const m = text.match(a);
    if (m && m.index !== undefined) {
      // Skip table-of-contents hits: a real section has substance after the heading.
      const start = Math.max(0, m.index - 200);
      const slice = text.slice(start, m.index + radius);
      if (slice.length > 1200) return slice;
    }
  }
  return null;
}

export async function governance(slug: string, ticker: string, cik: string): Promise<Governance | null> {
  const subs = await submissions(cik);
  const r = subs.recent;
  let idx = -1;
  for (let i = 0; i < r.form.length; i++) {
    if (r.form[i] === 'DEF 14A') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;
  const url = docUrl(cik, r.accessionNumber[idx], r.primaryDocument[idx]);

  let text: string;
  try {
    text = await fetchDocText(cik, r.accessionNumber[idx], r.primaryDocument[idx]);
  } catch {
    return { proxyUrl: url, filedAt: r.filingDate[idx], ceoCompUSD: null, relatedParty: null, shareholderProposals: null, notes: null, provenance: 'sec_def14a' };
  }

  const comp = excerptAround(text, [/Summary Compensation Table/i], 6000);
  const related = excerptAround(text, [/Certain Relationships and Related/i, /Related[- ]Person Transactions/i, /Related[- ]Party Transactions/i], 4000);
  const proposals = excerptAround(text, [/Shareholder Proposal/i, /Stockholder Proposal/i], 3000);

  const sections = [
    comp ? `COMPENSATION EXCERPT:\n${comp}` : null,
    related ? `RELATED PARTY EXCERPT:\n${related}` : null,
    proposals ? `PROPOSALS EXCERPT:\n${proposals}` : null,
  ].filter(Boolean);
  if (!sections.length) {
    return { proxyUrl: url, filedAt: r.filingDate[idx], ceoCompUSD: null, relatedParty: null, shareholderProposals: null, notes: null, provenance: 'sec_def14a' };
  }

  const prompt = [
    `Excerpts from the latest proxy statement (DEF 14A) of ${ticker}. Extract to JSON with keys:`,
    '  "ceoCompUSD": most recent fiscal year total compensation for the CEO in dollars as a number, or null if not determinable from the excerpt,',
    '  "relatedParty": one factual sentence describing any disclosed related-party transaction, or null if the excerpt reports none,',
    '  "shareholderProposals": count of shareholder or stockholder proposals on the ballot as a number, or null if not determinable,',
    '  "notes": one sentence flagging anything a portfolio manager would want to know from these excerpts (unusual pay structure, board entrenchment, an activist proposal), or null.',
    'Only state what the excerpts support. Plain factual sentences. No em-dashes, no exclamation points, no superlatives.',
    '',
    sections.join('\n\n').slice(0, CONFIG.evidence.proxyMaxChars),
  ].join('\n');

  try {
    const raw = await llm(slug, `governance-${ticker}`, prompt, 'json', 'light');
    const p = JSON.parse(raw) as { ceoCompUSD?: number | null; relatedParty?: string | null; shareholderProposals?: number | null; notes?: string | null };
    const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    return {
      proxyUrl: url,
      filedAt: r.filingDate[idx],
      ceoCompUSD: num(p.ceoCompUSD),
      relatedParty: p.relatedParty ? String(p.relatedParty).trim() : null,
      shareholderProposals: num(p.shareholderProposals),
      notes: p.notes ? String(p.notes).trim() : null,
      provenance: 'sec_def14a',
    };
  } catch {
    return { proxyUrl: url, filedAt: r.filingDate[idx], ceoCompUSD: null, relatedParty: null, shareholderProposals: null, notes: null, provenance: 'sec_def14a' };
  }
}
