import { llm } from './llm.js';
import type { MacroContext, MacroSeries } from '../types.js';

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

// Pick the two to four series that bear on the scenario, then fetch them.
export async function macroContext(slug: string, seed: string): Promise<MacroContext | null> {
  const menu = Object.entries(SERIES)
    .map(([id, label]) => `${id}: ${label}`)
    .join('\n');
  const prompt = [
    'A portfolio manager is testing this scenario:',
    seed,
    '',
    'From the list below, pick the 2 to 4 data series most relevant to the cost structures or demand drivers in the scenario.',
    'Answer in JSON: {"ids": ["SERIES_ID", ...]}. Only IDs from the list.',
    '',
    menu,
  ].join('\n');

  let ids: string[];
  try {
    const raw = await llm(slug, 'macro-picks', prompt, 'json', 'light');
    const parsed = JSON.parse(raw) as { ids?: string[] };
    ids = (parsed.ids ?? []).filter((id) => id in SERIES).slice(0, 4);
  } catch {
    return null;
  }
  if (!ids.length) return null;

  const series = (await Promise.all(ids.map(fredSeries))).filter((s): s is MacroSeries => s !== null);
  if (!series.length) return null;
  return { series, note: 'Federal Reserve Economic Data (FRED), latest observation with a year-over-year change where the history allows one.' };
}
