import { CONFIG } from '../config.js';
import { docUrl, fetchDocText, submissions } from './edgar.js';
import { llm } from './llm.js';
import type { CorporateEvent, EarningsLanguage } from '../types.js';

// 8-K item codes, decoded to what a PM scans for. The submissions feed carries
// the codes directly, so classification is deterministic and free.
const ITEM_LABELS: Record<string, string> = {
  '1.01': 'material agreement',
  '1.02': 'agreement terminated',
  '1.03': 'bankruptcy',
  '2.01': 'acquisition or disposition completed',
  '2.02': 'results announced',
  '2.03': 'new debt or credit facility',
  '2.04': 'debt acceleration',
  '2.05': 'exit or restructuring costs',
  '2.06': 'material impairment',
  '3.01': 'listing deficiency notice',
  '4.01': 'auditor change',
  '4.02': 'financials no longer reliable',
  '5.01': 'change of control',
  '5.02': 'officer or director change',
  '5.03': 'charter or bylaws change',
  '5.07': 'shareholder vote results',
  '7.01': 'Reg FD disclosure',
  '8.01': 'other material event',
};

// Items that move a thesis. 7.01/9.01 alone are routine furniture.
const SIGNAL_ITEMS = new Set(['1.01', '1.02', '1.03', '2.01', '2.03', '2.04', '2.05', '2.06', '3.01', '4.01', '4.02', '5.01', '5.02']);

export async function corporateEvents(cik: string): Promise<CorporateEvent[]> {
  const subs = await submissions(cik);
  const r = subs.recent as typeof subs.recent & { items?: string[] };
  const cutoff = new Date(Date.now() - CONFIG.evidence.eventsMonths * 30 * 86400_000).toISOString().slice(0, 10);

  const events: CorporateEvent[] = [];
  for (let i = 0; i < r.form.length && events.length < CONFIG.evidence.eventsMax; i++) {
    if (r.form[i] !== '8-K' || r.filingDate[i] < cutoff) continue;
    const codes = String(r.items?.[i] ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && c !== '9.01');
    if (!codes.length) continue;
    events.push({
      filedAt: r.filingDate[i],
      items: codes.map((c) => ({ code: c, label: ITEM_LABELS[c] ?? 'item ' + c })),
      signal: codes.some((c) => SIGNAL_ITEMS.has(c)),
      url: docUrl(cik, r.accessionNumber[i], r.primaryDocument[i]),
      accession: r.accessionNumber[i],
    });
  }
  return events;
}

// Locate the press-release exhibit (EX-99.*) inside an 8-K's filing folder.
async function exhibit99Text(cik: string, accession: string): Promise<string | null> {
  const folder = accession.replace(/-/g, '');
  const idxUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${folder}/index.json`;
  try {
    const res = await fetch(idxUrl, { headers: { 'User-Agent': CONFIG.userAgent } });
    if (!res.ok) return null;
    const idx = (await res.json()) as any;
    const items: Array<{ name: string }> = idx.directory?.item ?? [];
    // Filers name it ex99-1, ex_99, exhibit991q12026earningspr, a52990ex99...
    const ex = items.find((f) => /ex(?:hibit)?[-_.]?99/i.test(f.name) && /\.htm/i.test(f.name));
    if (!ex) return null;
    const text = await fetchDocText(cik, accession, ex.name);
    return text.length > 500 ? text : null;
  } catch {
    return null;
  }
}

// The free stand-in for paid transcript archives: earnings press releases are
// filed as EX-99 exhibits on Item 2.02 8-Ks. Read the two most recent, and ask
// the light model what management leads with and how the language moved quarter
// over quarter. Weaker than a transcript Q&A read, and labeled as such.
export async function earningsLanguage(slug: string, ticker: string, cik: string): Promise<EarningsLanguage | null> {
  const subs = await submissions(cik);
  const r = subs.recent as typeof subs.recent & { items?: string[] };
  const releases: Array<{ accession: string; filedAt: string }> = [];
  for (let i = 0; i < r.form.length && releases.length < 2; i++) {
    if (r.form[i] === '8-K' && String(r.items?.[i] ?? '').includes('2.02')) {
      releases.push({ accession: r.accessionNumber[i], filedAt: r.filingDate[i] });
    }
  }
  if (!releases.length) return null;

  const texts: string[] = [];
  for (const rel of releases) {
    const t = await exhibit99Text(cik, rel.accession);
    if (t) texts.push(t.slice(0, CONFIG.evidence.releaseMaxChars));
  }
  if (!texts.length) return null;

  const prompt = [
    `You are reading the earnings press release${texts.length > 1 ? 's (latest first)' : ''} of ${ticker}.`,
    'Answer in JSON with keys:',
    '  "emphasis": one sentence, which metrics management leads with and which are buried,',
    '  "drift": one sentence on how the language moved versus the prior release, or null if only one release is given,',
    '  "hedges": array of recurring hedge phrases quoted verbatim (like "short-term headwinds"), empty if none.',
    'Plain factual sentences. No em-dashes, no exclamation points, no superlatives.',
    '',
    texts.map((t, i) => `RELEASE ${i + 1} (${releases[i]?.filedAt ?? 'undated'}):\n${t}`).join('\n\n'),
  ].join('\n');

  try {
    const raw = await llm(slug, `earnings-language-${ticker}`, prompt, 'json', 'light');
    const parsed = JSON.parse(raw) as { emphasis?: string; drift?: string | null; hedges?: string[] };
    return {
      emphasis: String(parsed.emphasis ?? '').trim() || null,
      drift: parsed.drift ? String(parsed.drift).trim() : null,
      hedges: Array.isArray(parsed.hedges) ? parsed.hedges.map(String).slice(0, 5) : [],
      releasesRead: texts.length,
      latestFiledAt: releases[0].filedAt,
      provenance: 'sec_8k_ex99',
    };
  } catch {
    return null;
  }
}
