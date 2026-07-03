import { CONFIG } from '../config.js';
import { submissions } from './edgar.js';
import { cleanName } from './usaspending.js';
import type { Candidate, ChainNode, Overlay, OverlayPosition } from '../types.js';

// 13F portfolio overlay: place any institution's reported holdings on the map.
// Everything here is free EDGAR data: the fund's latest 13F-HR information table,
// matched to run candidates by issuer name. 13F reports CUSIPs, not tickers, so
// the match is name-based; unmatched positions stay listed as unmatched.

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': CONFIG.userAgent } });
  if (!res.ok) throw new Error(`EDGAR ${res.status} ${url}`);
  return res.text();
}

// Resolve a fund name or CIK to a CIK via EDGAR company search (atom output).
export async function resolveFundCik(query: string): Promise<{ cik: string; name: string }> {
  const digits = query.replace(/\D/g, '');
  if (digits.length >= 4 && digits.length === query.trim().length) {
    return { cik: digits.padStart(10, '0'), name: `CIK ${digits}` };
  }
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(query)}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;
  const xml = await get(url);
  const cikMatch = xml.match(/<CIK>(\d+)<\/CIK>/i);
  const nameMatch = xml.match(/<conformed-name>([^<]+)<\/conformed-name>/i) ?? xml.match(/<title>([^<]+)<\/title>/i);
  if (!cikMatch) throw new Error(`No 13F filer found for "${query}".`);
  return { cik: cikMatch[1].padStart(10, '0'), name: (nameMatch?.[1] ?? query).trim() };
}

interface RawPosition {
  issuer: string;
  valueUSD: number;
}

// Latest 13F-HR information table for a fund.
export async function latestHoldings(cik: string): Promise<{ filedAt: string; positions: RawPosition[] }> {
  const subs = await submissions(cik);
  const r = subs.recent;
  const idx = r.form.findIndex((f) => f === '13F-HR' || f === '13F-HR/A');
  if (idx === -1) throw new Error('Filer has no 13F-HR in recent filings.');
  const accession = r.accessionNumber[idx];
  const filedAt = r.filingDate[idx];

  // The information table is a separate XML doc in the filing; find it via the index.
  const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}`;
  const index = JSON.parse(await get(`${dir}/index.json`)) as any;
  const items: { name: string }[] = index.directory?.item ?? [];
  const table = items.find((i) => /\.xml$/i.test(i.name) && !/primary_doc/i.test(i.name));
  if (!table) throw new Error('No information table XML in the 13F filing.');
  const xml = await get(`${dir}/${table.name}`);

  const positions: RawPosition[] = [];
  const blocks = xml.match(/<(?:\w+:)?infoTable>[\s\S]*?<\/(?:\w+:)?infoTable>/gi) ?? [];
  for (const b of blocks) {
    const issuer = b.match(/<(?:\w+:)?nameOfIssuer>([^<]+)</i)?.[1]?.trim();
    const value = Number(b.match(/<(?:\w+:)?value>([\d.]+)</i)?.[1] ?? 0);
    if (!issuer) continue;
    // 13F value is reported in whole dollars since the 2023 rule change.
    positions.push({ issuer, valueUSD: Math.round(value) });
  }
  // The same issuer appears once per share class or manager; aggregate.
  const agg = new Map<string, number>();
  for (const p of positions) agg.set(p.issuer, (agg.get(p.issuer) ?? 0) + p.valueUSD);
  return {
    filedAt,
    positions: [...agg.entries()].map(([issuer, valueUSD]) => ({ issuer, valueUSD })).sort((a, b) => b.valueUSD - a.valueUSD),
  };
}

// Name-overlap match of 13F issuers to run candidates.
export function overlayPositions(
  positions: RawPosition[],
  candidates: Candidate[],
  nodes: ChainNode[],
): OverlayPosition[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const cands = candidates.map((c) => ({ c, tokens: new Set(cleanName(c.name).toLowerCase().split(' ').filter(Boolean)) }));
  return positions.map((p) => {
    const tokens = cleanName(p.issuer).toLowerCase().split(' ').filter(Boolean);
    let bestMatch: Candidate | null = null;
    let bestOverlap = 0;
    for (const { c, tokens: ct } of cands) {
      const overlap = tokens.filter((t) => ct.has(t)).length;
      const needed = Math.min(2, tokens.length, ct.size);
      if (overlap >= needed && overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = c;
      }
    }
    const node = bestMatch ? nodeById.get(bestMatch.nodeId) : undefined;
    return {
      issuer: p.issuer,
      valueUSD: p.valueUSD,
      matchedTicker: bestMatch?.ticker ?? null,
      nodeId: node?.id ?? null,
      polarity: node?.polarity ?? null,
    };
  });
}

export function summarize(fund: Overlay['fund'], positions: OverlayPosition[]): Overlay {
  const matched = positions.filter((p) => p.matchedTicker);
  return {
    fund,
    positions,
    summary: {
      totalPositions: positions.length,
      matched: matched.length,
      onBeneficiary: matched.filter((p) => p.polarity === 'beneficiary').length,
      onAtRisk: matched.filter((p) => p.polarity === 'at_risk').length,
    },
  };
}
