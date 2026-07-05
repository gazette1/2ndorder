import { CONFIG } from '../config.js';
import { cleanName } from './usaspending.js';
import type { RegulatorSignal } from '../types.js';

// Sector-regulator enrichment, routed by the filer's SIC code so a biotech is
// checked against FDA, a telecom against FCC dockets, a utility or pipeline
// against FERC. All three sources are free; openFDA and FCC ECFS accept a
// data.gov API key for higher rate limits (DATA_GOV_API_KEY), FERC needs none.
// FCC ECFS requires the key, so without one that check is skipped, not faked.

function sicNum(sic: string | null): number {
  const n = Number(sic);
  return Number.isFinite(n) ? n : 0;
}

export function regulatorFor(sic: string | null): 'FDA' | 'FCC' | 'FERC' | null {
  const n = sicNum(sic);
  if ((n >= 2833 && n <= 2836) || (n >= 3841 && n <= 3851) || n === 8731) return 'FDA';
  if (n >= 4800 && n <= 4899 || n === 3663) return 'FCC';
  if ((n >= 4900 && n <= 4939) || (n >= 4600 && n <= 4629) || n === 4991) return 'FERC';
  return null;
}

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': CONFIG.userAgent, ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${res.status} ${url.split('?')[0]}`);
  return res.json();
}

function keyParam(): string {
  return CONFIG.dataGovKey ? `api_key=${CONFIG.dataGovKey}&` : '';
}

// openFDA: approved drug applications, device clearances, and open recalls
// under the filer's cleaned name. A miss can mean the products sit under a
// subsidiary name; the signal says so instead of implying a clean slate.
// openFDA sponsor names rarely match the full EDGAR filer name: "AQUESTIVE
// THERAPEUTICS" files as "AQUESTIVE", and FDA abbreviates ("KARYOPHARM
// THERAPS"). Try the exact cleaned phrase, then a wildcard on the first
// distinctive word, which is what catches the abbreviations.
function fdaQueryCandidates(name: string): string[] {
  const cleaned = cleanName(name).toUpperCase();
  const first = cleaned.split(' ')[0] ?? '';
  const out = [`"${cleaned}"`];
  if (first.length >= 5) out.push(`${first}*`);
  return out;
}

async function fdaCount(endpoint: string, field: string, queries: string[], extra = ''): Promise<{ n: number; results: any[] }> {
  for (const query of queries) {
    try {
      const q = encodeURIComponent(query).replace(/%2A/g, '*');
      const d = await getJson(`https://api.fda.gov/${endpoint}?${keyParam()}search=${field}:${q}${extra}&limit=3`);
      const n = d.meta?.results?.total ?? 0;
      if (n) return { n, results: d.results ?? [] };
    } catch {
      /* 404 means zero matches for this query; try the next */
    }
  }
  return { n: 0, results: [] };
}

async function fdaSignal(name: string): Promise<RegulatorSignal> {
  const names = fdaQueryCandidates(name);
  const items: RegulatorSignal['items'] = [];

  const drugs = await fdaCount('drug/drugsfda.json', 'sponsor_name', names);
  if (drugs.n) {
    const brands = [...new Set<string>(drugs.results.flatMap((r: any) => (r.products ?? []).map((p: any) => String(p.brand_name ?? ''))).filter(Boolean))].slice(0, 4);
    items.push({ date: null, text: `${drugs.n} approved drug application(s) on file${brands.length ? `, including ${brands.join(', ')}` : ''}` });
  }

  const devices = await fdaCount('device/510k.json', 'applicant', names, '&sort=decision_date:desc');
  if (devices.n) {
    const r = devices.results[0];
    items.push({
      date: r?.decision_date ?? null,
      text: `${devices.n} device 510(k) clearance(s), latest ${r?.decision_date ?? 'undated'}: ${String(r?.device_name ?? '').slice(0, 80)}`,
    });
  }

  const recalls = await fdaCount('drug/enforcement.json', 'recalling_firm', names, '+AND+status:"Ongoing"');
  if (recalls.n) items.push({ date: null, text: `${recalls.n} ongoing drug recall(s) as recalling firm` });

  const total = drugs.n + devices.n;
  return {
    agency: 'FDA',
    headline: total
      ? `${total} FDA record(s) under the filer name`
      : 'No FDA records under the filer name; approvals may sit under a subsidiary or product-company name',
    items,
    provenance: 'openfda',
  };
}

// FCC ECFS: how present the company is in open rulemaking dockets. Volume and
// recency of filings say where the regulatory exposure is.
async function fccSignal(name: string): Promise<RegulatorSignal | null> {
  if (!CONFIG.dataGovKey) return null; // ECFS rejects keyless requests; skip honestly
  const q = encodeURIComponent(`"${cleanName(name)}"`);
  const d = await getJson(
    `https://publicapi.fcc.gov/ecfs/filings?api_key=${CONFIG.dataGovKey}&q=${q}&sort=date_disseminated,DESC&per_page=3`,
  );
  const filings: any[] = d.filing ?? d.filings ?? [];
  const total = d.aggregations?.total ?? d.total ?? filings.length;
  if (!filings.length) {
    return { agency: 'FCC', headline: 'No ECFS docket filings under the filer name', items: [], provenance: 'fcc_ecfs' };
  }
  const items = filings.slice(0, 3).map((f) => {
    const proceeding = f.proceedings?.[0];
    const date = String(f.date_disseminated ?? f.date_received ?? '').slice(0, 10) || null;
    return {
      date,
      text: `${f.submissiontype?.description ?? 'filing'} in ${proceeding?.name ?? 'unnamed proceeding'}${proceeding?.subject ? `: ${String(proceeding.subject).slice(0, 90)}` : ''}`,
    };
  });
  return { agency: 'FCC', headline: `Appears in FCC dockets (${total} ECFS filings matched)`, items, provenance: 'fcc_ecfs' };
}

// FERC eLibrary: dockets naming the company. Rate cases, certificates, and
// enforcement all land here first.
async function fercSignal(name: string): Promise<RegulatorSignal> {
  const body = {
    searchText: cleanName(name),
    searchDescription: true,
    searchFullText: false,
    dateSearches: [],
    availability: null,
    affiliations: [],
    categories: [],
    libraries: [],
    accessionNumber: null,
    eFiling: false,
    docketSearches: [],
    resultsPerPage: 3,
    curPage: 1,
    classTypes: [],
    sortBy: '',
    groupBy: '',
    idList: [],
    allDates: true,
  };
  const d = await getJson('https://elibrary.ferc.gov/eLibrarywebapi/api/Search/AdvancedSearch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const hits: any[] = d.searchHits ?? [];
  if (!hits.length) {
    return { agency: 'FERC', headline: 'No FERC eLibrary documents under the filer name', items: [], provenance: 'ferc_elibrary' };
  }
  const items = hits.slice(0, 3).map((h) => ({
    date: h.issuedDate ?? h.filedDate ?? null,
    text: `${String(h.description ?? '').slice(0, 110)}${(h.docketNumbers ?? []).length ? ` (docket ${h.docketNumbers[0]})` : ''}`,
  }));
  return { agency: 'FERC', headline: `${d.totalHits ?? hits.length} FERC eLibrary documents match the filer name`, items, provenance: 'ferc_elibrary' };
}

export async function regulatorSignal(sic: string | null, name: string): Promise<RegulatorSignal | null> {
  const agency = regulatorFor(sic);
  if (!agency) return null;
  try {
    if (agency === 'FDA') return await fdaSignal(name);
    if (agency === 'FCC') return await fccSignal(name);
    return await fercSignal(name);
  } catch {
    return null; // a regulator API hiccup never sinks the dossier
  }
}
