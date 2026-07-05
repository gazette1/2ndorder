import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import type { FtsHit, Fundamentals, InsiderSummary, InsiderTx } from '../types.js';

const CACHE_DIR = path.resolve('data/cache');

// SEC fair-access guideline is 10 requests per second. One throttle for every EDGAR host.
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 150 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

// efts.sec.gov throws intermittent 500s on well-formed queries, and fetch itself
// occasionally throws a transient network error; retry both before giving up.
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
      if (res.ok) return res;
      if (attempt >= 4 || res.status === 404) throw new Error(`EDGAR ${res.status} ${url}`);
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
}

async function getJson<T>(url: string): Promise<T> {
  return (await get(url)).json() as Promise<T>;
}

function cachePath(name: string) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  return path.join(CACHE_DIR, name);
}

export interface FtsResult {
  cik: string;
  companyName: string;
  hit: FtsHit;
}

// Full-text search (efts.sec.gov). Phrase must be quoted or the API 500s on multi-word queries.
export async function fullTextSearch(phrase: string, startdt: string, enddt: string): Promise<FtsResult[]> {
  const q = encodeURIComponent(`"${phrase}"`);
  const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&forms=${CONFIG.ftsForms}&dateRange=custom&startdt=${startdt}&enddt=${enddt}`;
  const raw = await getJson<any>(url);
  const results: FtsResult[] = [];
  for (const h of raw.hits?.hits ?? []) {
    const src = h._source ?? {};
    const [accession, docId] = String(h._id).split(':');
    const cik = String(src.ciks?.[0] ?? '').padStart(10, '0');
    if (!cik.trim()) continue;
    results.push({
      cik,
      companyName: String(src.display_names?.[0] ?? '').replace(/\s*\(CIK.*$/, ''),
      hit: {
        form: String(src.root_forms?.[0] ?? src.file_type ?? ''),
        accession,
        filedAt: String(src.file_date ?? ''),
        docId,
      },
    });
  }
  return results;
}

// CIK -> { ticker, title } from the SEC's canonical mapping file, cached on disk.
// A CIK can list several tickers (share classes, warrants); the file lists the
// primary first, so keep the FIRST per CIK. This is what stops a warrant ticker
// (PDYNW, SLDPW) from standing in for the company.
export async function tickerMap(): Promise<Map<string, { ticker: string; title: string }>> {
  const p = cachePath('company_tickers.json');
  if (!fs.existsSync(p)) {
    const raw = await get('https://www.sec.gov/files/company_tickers.json');
    fs.writeFileSync(p, await raw.text());
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const map = new Map<string, { ticker: string; title: string }>();
  for (const row of Object.values(data)) {
    const cik = String(row.cik_str).padStart(10, '0');
    if (!map.has(cik)) map.set(cik, { ticker: row.ticker, title: row.title });
  }
  return map;
}

// Latest reported common shares outstanding (10-K/10-Q cover), quarterly-fresh.
export async function sharesOutstanding(cik: string): Promise<number | null> {
  const h = await sharesHistory(cik);
  return h?.latest ?? null;
}

// Latest share count plus the closest reading from about a year earlier, for a
// dilution read. Small caps fund themselves by printing shares; the change is the tell.
export async function sharesHistory(cik: string): Promise<{ latest: number; yearAgo: number | null } | null> {
  try {
    const data = await getJson<any>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/dei/EntityCommonStockSharesOutstanding.json`,
    );
    const facts = (data.units?.shares ?? []).filter((f: any) => Number.isFinite(Number(f.val)) && Number(f.val) > 0);
    if (!facts.length) return null;
    facts.sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
    const last = facts[facts.length - 1];
    const target = new Date(new Date(last.end).getTime() - 365 * 86400_000).toISOString().slice(0, 10);
    let yearAgo: number | null = null;
    for (let i = facts.length - 2; i >= 0; i--) {
      if (facts[i].end <= target) {
        yearAgo = Number(facts[i].val);
        break;
      }
    }
    return { latest: Number(last.val), yearAgo };
  } catch {
    return null;
  }
}

// Total debt, approximate: the broadest long-term debt concept the filer reports.
export async function debtUSD(cik: string): Promise<number | null> {
  const hit = await latestAnnual(cik, ['LongTermDebt', 'LongTermDebtNoncurrent', 'DebtLongtermAndShorttermCombinedAmount']);
  return hit?.val ?? null;
}

// Annual operating cash flow, for the burn-rate read on pre-profit names.
export async function operatingCashFlowUSD(cik: string): Promise<number | null> {
  const hit = await latestAnnual(cik, ['NetCashProvidedByUsedInOperatingActivities']);
  return hit?.val ?? null;
}

// Latest dei:EntityPublicFloat in USD MM, or null when the company has never reported one.
export async function publicFloatMM(cik: string): Promise<number | null> {
  try {
    const data = await getJson<any>(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/dei/EntityPublicFloat.json`);
    const facts = data.units?.USD ?? [];
    if (!facts.length) return null;
    facts.sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
    return Math.round(facts[facts.length - 1].val / 1e6);
  } catch {
    return null;
  }
}

export interface Submissions {
  recent: { form: string[]; accessionNumber: string[]; filingDate: string[]; primaryDocument: string[] };
}

export async function submissions(cik: string): Promise<Submissions> {
  const data = await getJson<any>(`https://data.sec.gov/submissions/CIK${cik}.json`);
  return { recent: data.filings.recent };
}

// SIC code from the same submissions record, for sector-conditional enrichment
// (which regulator's docket system to check).
export async function companySic(cik: string): Promise<{ sic: string | null; sicDescription: string | null }> {
  try {
    const data = await getJson<any>(`https://data.sec.gov/submissions/CIK${cik}.json`);
    return { sic: data.sic ? String(data.sic) : null, sicDescription: data.sicDescription ? String(data.sicDescription) : null };
  } catch {
    return { sic: null, sicDescription: null };
  }
}

export function docUrl(cik: string, accession: string, docId: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${docId}`;
}

// ---- Insider transactions (Form 4) ----

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`, 'i'));
  return m ? m[1].trim() : null;
}
// Form 4 wraps most numeric fields in a nested <value>; read the first one in a block.
function valueOf(block: string, name: string): string | null {
  const outer = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  if (!outer) return null;
  return tag(outer[1], 'value') ?? outer[1].trim();
}

function parseForm4(xml: string, accession: string): InsiderTx[] {
  const owner = tag(xml, 'rptOwnerName') ?? 'Unknown';
  const isOfficer = tag(xml, 'isOfficer') === '1';
  const isDirector = tag(xml, 'isDirector') === '1';
  // Founder and CEO conviction is the target. A pure 10 percent holder (a fund or
  // sponsor distributing stock) files Form 4 too; exclude it so the signal is management.
  if (!isOfficer && !isDirector) return [];
  const role = isOfficer ? tag(xml, 'officerTitle') ?? 'Officer' : 'Director';

  const txs: InsiderTx[] = [];
  const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/gi) ?? [];
  for (const b of blocks) {
    const code = valueOf(b, 'transactionCode') ?? '';
    // Some filings put footnote text or nothing in numeric fields; NaN here would
    // poison the whole net (NaN serializes to null in JSON). Coerce to finite.
    const num = (v: string | null) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const shares = num(valueOf(b, 'transactionShares'));
    const price = num(valueOf(b, 'transactionPricePerShare'));
    const ad = (valueOf(b, 'transactionAcquiredDisposedCode') ?? '') as 'A' | 'D';
    const date = valueOf(b, 'transactionDate') ?? '';
    if (!shares) continue;
    txs.push({ insider: owner, role, code, shares, price, valueUSD: Math.round(shares * price), acquiredDisposed: ad, date, accession });
  }
  return txs;
}

// Open-market insider activity over the look-back window. Grants (A), option
// exercises (M), gifts (G), and tax withholding (F) are excluded from the net;
// only P (open-market buy) and S (open-market sale) express conviction.
export async function insiderSummary(cik: string): Promise<InsiderSummary> {
  const subs = await submissions(cik);
  const r = subs.recent;
  const cutoff = new Date(Date.now() - CONFIG.enrich.insiderMonths * 30 * 86400_000).toISOString().slice(0, 10);

  // Form 5 is the annual catch-up report; same XML schema as Form 4, same parser.
  const idx: number[] = [];
  for (let i = 0; i < r.form.length; i++) {
    if ((r.form[i] === '4' || r.form[i] === '5') && r.filingDate[i] >= cutoff) idx.push(i);
    if (idx.length >= CONFIG.enrich.insiderMaxFilings) break;
  }

  const all: InsiderTx[] = [];
  for (const i of idx) {
    const raw = String(r.primaryDocument[i]).split('/').pop(); // strip the xslF345X0N/ render prefix
    if (!raw) continue;
    try {
      const xml = await (await get(docUrl(cik, r.accessionNumber[i], raw))).text();
      all.push(...parseForm4(xml, r.accessionNumber[i]));
    } catch {
      continue; // a single unparseable Form 4 does not sink the summary
    }
  }

  const buys = all.filter((t) => t.code === 'P');
  const sells = all.filter((t) => t.code === 'S');
  const netBuyUSD = buys.reduce((s, t) => s + t.valueUSD, 0) - sells.reduce((s, t) => s + t.valueUSD, 0);

  // Form 144 is the notice of PROPOSED sale: it leads the Form 4 that records
  // the executed one. Count on the issuer's feed, trailing 90 days.
  const cutoff144 = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  let form144Count90d = 0;
  let form144LatestDate: string | null = null;
  for (let i = 0; i < r.form.length; i++) {
    if ((r.form[i] === '144' || r.form[i] === '144/A') && r.filingDate[i] >= cutoff144) {
      form144Count90d++;
      if (!form144LatestDate || r.filingDate[i] > form144LatestDate) form144LatestDate = r.filingDate[i];
    }
  }

  return {
    window: `trailing ${CONFIG.enrich.insiderMonths} months`,
    netBuyUSD,
    buyCount: buys.length,
    sellCount: sells.length,
    distinctBuyers: new Set(buys.map((t) => t.insider)).size,
    transactions: [...buys, ...sells].sort((a, b) => b.date.localeCompare(a.date)),
    form144Count90d,
    form144LatestDate,
    provenance: 'sec_form4',
  };
}

// ---- Fundamentals (XBRL company facts) ----

async function latestAnnual(cik: string, tags: string[]): Promise<{ val: number; end: string } | null> {
  for (const t of tags) {
    try {
      const data = await getJson<any>(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${t}.json`);
      const annual = (data.units?.USD ?? []).filter((f: any) => f.form === '10-K' && f.fp === 'FY');
      if (!annual.length) continue;
      annual.sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
      const last = annual[annual.length - 1];
      return { val: last.val, end: last.end };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fundamentals(cik: string): Promise<Fundamentals> {
  const revenueTags = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'];
  const rev = await latestAnnual(cik, revenueTags);
  let revPrior: number | null = null;
  if (rev) {
    // Second-latest FY for the same revenue concept, for a growth read.
    for (const t of revenueTags) {
      try {
        const data = await getJson<any>(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${t}.json`);
        const annual = (data.units?.USD ?? []).filter((f: any) => f.form === '10-K' && f.fp === 'FY');
        if (annual.length < 2) continue;
        annual.sort((a: any, b: any) => String(a.end).localeCompare(String(b.end)));
        revPrior = annual[annual.length - 2].val;
        break;
      } catch {
        continue;
      }
    }
  }
  const ni = await latestAnnual(cik, ['NetIncomeLoss']);
  const rd = await latestAnnual(cik, ['ResearchAndDevelopmentExpense']);
  const cash = await latestAnnual(cik, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']);
  return {
    revenueUSD: rev?.val ?? null,
    revenuePriorUSD: revPrior,
    netIncomeUSD: ni?.val ?? null,
    rdExpenseUSD: rd?.val ?? null,
    cashUSD: cash?.val ?? null,
    asOf: rev?.end ?? ni?.end ?? null,
    provenance: 'sec_xbrl',
  };
}

// Filing document as plain text, tags stripped, whitespace collapsed.
export async function fetchDocText(cik: string, accession: string, docId: string): Promise<string> {
  const html = await (await get(docUrl(cik, accession, docId))).text();
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;|&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}
