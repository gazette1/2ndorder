import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { llm } from './llm.js';
import type { FomcStance, IndustryAnchor, MacroContext, MacroSeries } from '../types.js';

// FRED's chart-download CSV endpoint is keyless and free; the API proper wants a
// registered key. Series whitelist keeps the model choosing, not inventing.
const SERIES: Record<string, string> = {
  CPIAUCSL: 'CPI, all items',
  PPIACO: 'PPI, all commodities',
  FEDFUNDS: 'effective fed funds rate',
  DGS10: '10-year treasury yield',
  T10Y2Y: '10-year minus 2-year spread',
  UNRATE: 'unemployment rate',
  PAYEMS: 'nonfarm payrolls',
  JTSJOL: 'job openings (JOLTS)',
  INDPRO: 'industrial production index',
  HOUST: 'housing starts',
  RSAFS: 'retail sales',
  DCOILWTICO: 'WTI crude oil price',
  DHHNGSP: 'Henry Hub natural gas price',
  DTWEXBGS: 'trade-weighted dollar index',
  PCU221122221122: 'PPI, electric power distribution',
  PCU325412325412: 'PPI, pharmaceutical preparation manufacturing',
  PCU334413334413: 'PPI, semiconductor manufacturing',
  // Industry-level cuts. These are BLS and Census series riding FRED's keyless
  // mirror, which beats the direct BLS API's 25-requests-a-day keyless cap.
  TTLCONS: 'total construction spending',
  DGORDER: 'durable goods new orders',
  PERMIT: 'building permits',
  IPMAN: 'industrial production, manufacturing',
  PCU484121484121: 'PPI, long-distance general freight trucking',
  PCU336411336411: 'PPI, aircraft manufacturing',
  PCU211120211120: 'PPI, crude petroleum and natural gas extraction',
  PCU325211325211: 'PPI, plastics materials and resins',
  CES6562000001: 'health care employment',
};

// NAICS menu for the Census County Business Patterns size anchor. Fixed menu so
// the model picks, never invents a code.
const NAICS: Record<string, string> = {
  '2361': 'residential construction',
  '2211': 'electric power generation and distribution',
  '3116': 'meat processing',
  '3251': 'basic chemical manufacturing',
  '3254': 'pharmaceutical manufacturing',
  '3341': 'computer and peripheral manufacturing',
  '3344': 'semiconductor manufacturing',
  '3364': 'aerospace manufacturing',
  '4841': 'general freight trucking',
  '4451': 'grocery stores',
  '5112': 'software publishers',
  '5182': 'data processing and hosting',
  '5415': 'computer systems design services',
  '6211': 'physician offices',
  '6221': 'hospitals',
  '5613': 'employment services',
};

async function fredSeries(id: string): Promise<MacroSeries | null> {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research)' },
    });
    if (!res.ok) return null;
    const rows = (await res.text())
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => {
        const [date, v] = l.split(',');
        return { date, val: Number(v) };
      })
      .filter((r) => Number.isFinite(r.val));
    if (rows.length < 2) return null;
    const latest = rows[rows.length - 1];
    // Closest observation to one year before the latest, for a YoY read.
    const target = new Date(new Date(latest.date).getTime() - 365 * 86400_000).toISOString().slice(0, 10);
    let prior: { date: string; val: number } | null = null;
    for (let i = rows.length - 2; i >= 0; i--) {
      if (rows[i].date <= target) {
        prior = rows[i];
        break;
      }
    }
    const yoyPct = prior && prior.val !== 0 ? Math.round(((latest.val - prior.val) / Math.abs(prior.val)) * 1000) / 10 : null;
    return { id, label: SERIES[id] ?? id, latest: latest.val, asof: latest.date, yoyPct, provenance: 'fred' };
  } catch {
    return null;
  }
}

// Latest FOMC minutes, summarized to a rates stance once per FOMC cycle and
// cached on disk, so the model read costs one call per cycle, not per run.
async function fomcStance(slug: string): Promise<FomcStance | null> {
  try {
    const cal = await (
      await fetch('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', {
        headers: { 'User-Agent': 'Mozilla/5.0 (research)' },
      })
    ).text();
    const dates = [...cal.matchAll(/\/monetarypolicy\/fomcminutes(\d{8})\.htm/g)].map((m) => m[1]).sort();
    const latest = dates[dates.length - 1];
    if (!latest) return null;

    const cacheDir = path.resolve('data/cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, `fomc-${latest}.json`);
    if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as FomcStance;

    const html = await (
      await fetch(`https://www.federalreserve.gov/monetarypolicy/fomcminutes${latest}.htm`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (research)' },
      })
    ).text();
    const text = html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[#a-z0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ');
    // The stance lives in the back half: participants' views and the policy action.
    const tail = text.slice(Math.max(0, Math.floor(text.length * 0.45)), Math.floor(text.length * 0.45) + 16000);

    const prompt = [
      'From this excerpt of the latest FOMC minutes, state the committee stance in 2 plain factual sentences:',
      'the policy action taken and the balance of risks or bias going forward. No em-dashes, no exclamation points, no superlatives.',
      'Answer in JSON: {"stance": "..."}',
      '',
      tail,
    ].join('\n');
    const raw = await llm(slug, `fomc-${latest}`, prompt, 'json', 'light');
    const stance = String((JSON.parse(raw) as { stance?: string }).stance ?? '').trim();
    if (!stance) return null;
    const date = `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}`;
    const out: FomcStance = { date, stance, provenance: 'federalreserve' };
    fs.writeFileSync(cacheFile, JSON.stringify(out, null, 2));
    return out;
  } catch {
    return null;
  }
}

// Census County Business Patterns: how big the picked industry actually is
// (establishments, employees, payroll). A sanity anchor against the TAM claims
// companies quote in filings. Census requires its own free key.
async function industryAnchor(naics: string): Promise<IndustryAnchor | null> {
  if (!CONFIG.censusKey || !(naics in NAICS)) return null;
  try {
    const url = `https://api.census.gov/data/2023/cbp?get=ESTAB,EMP,PAYANN&for=us:*&NAICS2022=${naics}&key=${CONFIG.censusKey}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (research)' } });
    if (!res.ok) return null;
    const rows = (await res.json()) as string[][];
    const [estab, emp, payann] = rows[1] ?? [];
    if (!estab) return null;
    return {
      naics,
      label: NAICS[naics],
      establishments: Number(estab),
      employees: Number(emp),
      annualPayrollUSD: Number(payann) * 1000, // CBP reports payroll in $1,000s
      year: 2023,
      provenance: 'census_cbp',
    };
  } catch {
    return null;
  }
}

// Pick the two to four series (and optionally one NAICS industry) that bear on
// the scenario, then fetch them all.
export async function macroContext(slug: string, seed: string): Promise<MacroContext | null> {
  const menu = Object.entries(SERIES)
    .map(([id, label]) => `${id}: ${label}`)
    .join('\n');
  const naicsMenu = Object.entries(NAICS)
    .map(([code, label]) => `${code}: ${label}`)
    .join('\n');
  const prompt = [
    'A portfolio manager is testing this scenario:',
    seed,
    '',
    'From the SERIES list below, pick the 2 to 4 data series most relevant to the cost structures or demand drivers in the scenario.',
    'From the INDUSTRY list, pick the single industry most central to the scenario, or null if none fits.',
    'Answer in JSON: {"ids": ["SERIES_ID", ...], "naics": "CODE" or null}. Only entries from the lists.',
    '',
    'SERIES:',
    menu,
    '',
    'INDUSTRY:',
    naicsMenu,
  ].join('\n');

  let ids: string[] = [];
  let naics: string | null = null;
  try {
    const raw = await llm(slug, 'macro-picks', prompt, 'json', 'light');
    const parsed = JSON.parse(raw) as { ids?: string[]; naics?: string | null };
    ids = (parsed.ids ?? []).filter((id) => id in SERIES).slice(0, 4);
    naics = parsed.naics && String(parsed.naics) in NAICS ? String(parsed.naics) : null;
  } catch {
    ids = [];
  }

  const [series, fomc, industry] = await Promise.all([
    Promise.all(ids.map(fredSeries)).then((r) => r.filter((s): s is MacroSeries => s !== null)),
    fomcStance(slug),
    naics ? industryAnchor(naics) : Promise.resolve(null),
  ]);
  if (!series.length && !fomc && !industry) return null;
  return {
    series,
    fomc,
    industry,
    note: 'Federal Reserve Economic Data (FRED), latest observation with a year-over-year change where the history allows one.',
  };
}
