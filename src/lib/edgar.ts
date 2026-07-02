import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import type { FtsHit } from '../types.js';

const CACHE_DIR = path.resolve('data/cache');

// SEC fair-access guideline is 10 requests per second. One throttle for every EDGAR host.
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 150 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

// efts.sec.gov throws intermittent 500s on well-formed queries; retry before giving up.
async function get(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
    if (res.ok) return res;
    if (attempt >= 4 || res.status === 404) throw new Error(`EDGAR ${res.status} ${url}`);
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
export async function tickerMap(): Promise<Map<string, { ticker: string; title: string }>> {
  const p = cachePath('company_tickers.json');
  if (!fs.existsSync(p)) {
    const raw = await get('https://www.sec.gov/files/company_tickers.json');
    fs.writeFileSync(p, await raw.text());
  }
  const data = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const map = new Map<string, { ticker: string; title: string }>();
  for (const row of Object.values(data)) {
    map.set(String(row.cik_str).padStart(10, '0'), { ticker: row.ticker, title: row.title });
  }
  return map;
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

export function docUrl(cik: string, accession: string, docId: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${docId}`;
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
