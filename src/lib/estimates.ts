import type { Estimates } from '../types.js';

// Analyst-estimate count is the under-coverage lens: few estimates plus a high
// composite is the sweet spot the product hunts for. No free complete source
// exists without a key, so this is a seam. Set FINNHUB_API_KEY to make it live.
export async function analystCoverage(ticker: string): Promise<Estimates> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return { analystCount: null, provenance: 'stub' };
  }
  const res = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${key}`);
  if (!res.ok) return { analystCount: null, provenance: 'stub' };
  const rows = (await res.json()) as any[];
  if (!rows?.length) return { analystCount: 0, provenance: 'finnhub' };
  const r = rows[0];
  const count = (r.strongBuy ?? 0) + (r.buy ?? 0) + (r.hold ?? 0) + (r.sell ?? 0) + (r.strongSell ?? 0);
  return { analystCount: count, provenance: 'finnhub' };
}
