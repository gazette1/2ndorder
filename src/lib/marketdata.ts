// Keyless delayed price quotes via Yahoo's chart endpoint. Unofficial but stable,
// used only to size companies into the market cap band; swap for a licensed feed
// at the same seam when one is paid for. Provenance is tagged accordingly.

let lastCall = 0;
async function throttle() {
  const wait = lastCall + 150 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

// Trailing ~3-month average daily dollar volume, from the same keyless endpoint.
export async function advUSD(ticker: string): Promise<number | null> {
  await throttle();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const r = data.chart?.result?.[0];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const volumes: (number | null)[] = r?.indicators?.quote?.[0]?.volume ?? [];
    let sum = 0;
    let n = 0;
    for (let i = 0; i < closes.length; i++) {
      const c = closes[i];
      const v = volumes[i];
      if (c && v && Number.isFinite(c) && Number.isFinite(v)) {
        sum += c * v;
        n++;
      }
    }
    return n >= 20 ? Math.round(sum / n) : null; // need a real sample, not a few prints
  } catch {
    return null;
  }
}

export async function priceUSD(ticker: string): Promise<number | null> {
  await throttle();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || meta.currency !== 'USD') return null;
    const p = Number(meta.regularMarketPrice);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}
