import { CONFIG } from '../config.js';
import { fullTextSearch, publicFloatMM, sharesOutstanding, tickerMap, type FtsResult } from '../lib/edgar.js';
import { priceUSD } from '../lib/marketdata.js';
import { load, save } from '../lib/store.js';
import type { Candidate, Decomposition } from '../types.js';

// Market cap in USD MM: delayed price x latest reported shares outstanding,
// falling back to 10-K public float when either input is missing.
async function marketCap(cik: string, ticker: string): Promise<{ capMM: number | null; source: Candidate['capSource'] }> {
  const [price, shares] = await Promise.all([priceUSD(ticker), sharesOutstanding(cik)]);
  if (price !== null && shares !== null) {
    return { capMM: Math.round((price * shares) / 1e6), source: 'price_x_shares' };
  }
  const float = await publicFloatMM(cik);
  return float === null ? { capMM: null, source: null } : { capMM: float, source: 'public_float' };
}

// Chain node -> small-cap tickers, via EDGAR full-text search on the node's phrases.
// nodeIds limits mapping to a subset (the drill case); results merge into the
// existing candidate set. Also writes filingHits and whiteSpace back onto nodes.
export async function mapTickers(slug: string, nodeIds?: string[]): Promise<Candidate[]> {
  const decomp = load<Decomposition>(slug, 'decompose');
  const nodes = nodeIds ? decomp.nodes.filter((n) => nodeIds.includes(n.id)) : decomp.nodes;
  const tickers = await tickerMap();

  // Filings-only backtest: bound the search window at the as-of date.
  const enddt = CONFIG.asof ?? new Date().toISOString().slice(0, 10);
  const startdt = new Date(new Date(enddt).getTime() - CONFIG.ftsYears * 365 * 86400_000).toISOString().slice(0, 10);

  // Aggregate FTS hits per CIK per node, and total hits per node for white space.
  const byNode = new Map<string, Map<string, { count: number; latest: FtsResult }>>();
  for (const node of nodes) {
    const agg = new Map<string, { count: number; latest: FtsResult }>();
    byNode.set(node.id, agg);
    let nodeHits = 0;
    for (const phrase of node.searchPhrases) {
      let hits: FtsResult[] = [];
      try {
        hits = await fullTextSearch(phrase, startdt, enddt);
      } catch (e) {
        console.warn(`[map] FTS failed for "${phrase}": ${(e as Error).message}`);
        continue;
      }
      nodeHits += hits.length;
      for (const h of hits) {
        const cur = agg.get(h.cik);
        if (!cur) agg.set(h.cik, { count: 1, latest: h });
        else {
          cur.count += 1;
          if (h.hit.filedAt > cur.latest.hit.filedAt) cur.latest = h;
        }
      }
      console.log(`[map] "${phrase}" -> ${hits.length} hits`);
    }
    node.filingHits = nodeHits;
    node.whiteSpace = nodeHits <= CONFIG.whiteSpaceMaxHits;
  }
  save(slug, 'decompose', decomp);

  // A CIK can hit several nodes; keep it on the node where it hit most.
  const best = new Map<string, { nodeId: string; count: number; latest: FtsResult }>();
  for (const [nodeId, agg] of byNode) {
    const top = [...agg.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, CONFIG.maxCiksPerNode);
    for (const [cik, v] of top) {
      const cur = best.get(cik);
      if (!cur || v.count > cur.count) best.set(cik, { nodeId, count: v.count, latest: v.latest });
    }
  }

  const [lo, hi] = CONFIG.capBandMM;
  const fresh: Candidate[] = [];
  for (const [cik, v] of best) {
    const listed = tickers.get(cik);
    if (!listed) continue; // no active ticker: delisted, private, or a co-filer
    const { capMM, source } = await marketCap(cik, listed.ticker);
    const base: Candidate = {
      cik,
      ticker: listed.ticker,
      name: listed.title,
      nodeId: v.nodeId,
      ftsHits: v.count,
      latestHit: v.latest.hit,
      marketCapMM: capMM,
      capSource: source,
      status: 'in_band',
    };
    if (capMM === null) {
      fresh.push({ ...base, status: 'filtered_out', filterReason: 'no market cap data (no price and no reported float)' });
    } else if (capMM < lo || capMM > hi) {
      fresh.push({ ...base, status: 'filtered_out', filterReason: `market cap $${capMM}MM outside $${lo}MM to $${hi}MM band` });
    } else {
      fresh.push(base);
    }
  }

  // Subset mapping merges with the existing set; a CIK already present keeps
  // whichever entry carries more hits.
  let candidates = fresh;
  if (nodeIds) {
    const prior: Candidate[] = (() => {
      try {
        return load<Candidate[]>(slug, 'candidates');
      } catch {
        return [];
      }
    })();
    const byCik = new Map<string, Candidate>(prior.map((c) => [c.cik, c]));
    for (const c of fresh) {
      const cur = byCik.get(c.cik);
      if (!cur || c.ftsHits > cur.ftsHits) byCik.set(c.cik, c);
    }
    candidates = [...byCik.values()];
  }

  candidates.sort((a, b) => b.ftsHits - a.ftsHits);
  save(slug, 'candidates', candidates);
  const inBand = candidates.filter((c) => c.status === 'in_band');
  const white = nodes.filter((n) => n.whiteSpace).length;
  console.log(`[map] ${candidates.length} companies mapped, ${inBand.length} inside the market cap band, ${white} white-space nodes`);
  return candidates;
}
