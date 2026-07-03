import type { Coverage, RatingAction } from '../types.js';

// Sell-side coverage: analyst count (the under-coverage lens), consensus rating and
// price target, and recent firm rating actions. The firm, grade, target, and date
// are free through aggregators; the bank report itself is paywalled and not served.
// Seam: set FINNHUB_API_KEY to go live. Without it this returns a labeled stub.
export async function coverage(ticker: string): Promise<Coverage> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return { analystCount: null, consensusRating: null, priceTargetMeanUSD: null, ratingActions: [], provenance: 'stub' };
  }

  const [recRes, ptRes, udRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${key}`),
    fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${ticker}&token=${key}`),
    fetch(`https://finnhub.io/api/v1/stock/upgrade-downgrade?symbol=${ticker}&token=${key}`),
  ]);

  const rec = recRes.ok ? ((await recRes.json()) as any[]) : [];
  const pt = ptRes.ok ? ((await ptRes.json()) as any) : {};
  const ud = udRes.ok ? ((await udRes.json()) as any[]) : [];

  const latest = rec[0] ?? {};
  const analystCount = rec.length
    ? (latest.strongBuy ?? 0) + (latest.buy ?? 0) + (latest.hold ?? 0) + (latest.sell ?? 0) + (latest.strongSell ?? 0)
    : null;

  const actions: RatingAction[] = (ud ?? []).slice(0, 6).map((a) => ({
    firm: String(a.gradeCompany ?? 'Unknown'),
    action: mapAction(a.action, a.fromGrade, a.toGrade),
    fromGrade: a.fromGrade || null,
    toGrade: String(a.toGrade ?? ''),
    priceTargetUSD: null,
    date: a.gradeTime ? new Date(a.gradeTime * 1000).toISOString().slice(0, 10) : '',
    url: sourceSearchUrl(String(a.gradeCompany ?? ''), ticker),
  }));

  return {
    analystCount,
    consensusRating: consensusFrom(latest),
    priceTargetMeanUSD: pt?.targetMean ? Math.round(pt.targetMean) : null,
    ratingActions: actions,
    provenance: 'finnhub',
  };
}

function mapAction(raw: string, from: string, to: string): RatingAction['action'] {
  const a = String(raw ?? '').toLowerCase();
  if (a.includes('up')) return 'upgrade';
  if (a.includes('down')) return 'downgrade';
  if (a.includes('init')) return 'initiate';
  if (!from && to) return 'initiate';
  return 'reiterate';
}

function consensusFrom(r: any): string | null {
  if (!r || !Object.keys(r).length) return null;
  const buys = (r.strongBuy ?? 0) + (r.buy ?? 0);
  const holds = r.hold ?? 0;
  const sells = (r.sell ?? 0) + (r.strongSell ?? 0);
  if (buys >= holds && buys >= sells) return 'Buy';
  if (sells >= buys && sells >= holds) return 'Sell';
  return 'Hold';
}

// The action is real and free; the report is not. Link to a search for the reported
// action rather than pretending to link to the bank's document.
function sourceSearchUrl(firm: string, ticker: string): string {
  const q = encodeURIComponent(`${firm} ${ticker} rating price target`);
  return `https://www.google.com/search?q=${q}`;
}
