import { CONFIG } from '../config.js';
import type { CustomerGraph, GovAward } from '../types.js';

// Strip corporate suffixes so "USA Rare Earth, Inc." matches "USA RARE EARTH LLC" in award data.
export function cleanName(name: string): string {
  return name
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|incorporated|corp|corporation|co|llc|lp|ltd|holdings|group|plc|sa|nv|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// USASpending rejects contract codes (A-D) and assistance codes (02-05) in one
// request, so query each group and merge.
const AWARD_GROUPS = [
  ['A', 'B', 'C', 'D'],
  ['02', '03', '04', '05'],
];

async function awardPage(name: string, codes: string[]): Promise<any[]> {
  const body = {
    filters: { recipient_search_text: [name], award_type_codes: codes },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency'],
    sort: 'Award Amount',
    order: 'desc',
    limit: 25,
  };
  const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': CONFIG.userAgent },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  return ((await res.json()) as any).results ?? [];
}

// Federal awards to a company, from USASpending.gov. This is the government-customer
// arm of the customer graph: hard dollars, keyless, complete back to 2007.
export async function govAwards(name: string): Promise<{ awards: GovAward[]; totalUSD: number }> {
  const clean = cleanName(name);
  const wanted = new Set(clean.toLowerCase().split(' ').filter(Boolean));
  const rows = (await Promise.all(AWARD_GROUPS.map((g) => awardPage(clean, g)))).flat();

  // The recipient search is fuzzy; keep only rows whose matched name shares the cleaned tokens.
  const awards: GovAward[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row['Award ID'] ?? '');
    if (seen.has(id)) continue;
    const matched = String(row['Recipient Name'] ?? '');
    const tokens = new Set(cleanName(matched).toLowerCase().split(' ').filter(Boolean));
    const overlap = [...wanted].filter((t) => tokens.has(t)).length;
    if (overlap < Math.min(2, wanted.size)) continue;
    seen.add(id);
    awards.push({
      awardId: id,
      agency: String(row['Awarding Agency'] ?? ''),
      amountUSD: Math.round(Number(row['Award Amount'] ?? 0)),
      recipientMatched: matched,
    });
  }
  awards.sort((a, b) => b.amountUSD - a.amountUSD);
  return { awards, totalUSD: awards.reduce((s, a) => s + a.amountUSD, 0) };
}

export function emptyCustomerGraph(): CustomerGraph {
  return { govAwards: [], govAwardTotalUSD: 0, reverseCites: [], reverseCiteCount: 0, namedCustomers: [], provenance: 'usaspending' };
}
