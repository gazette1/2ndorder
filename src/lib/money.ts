// Dollar convention on product surfaces: K thousands, M millions, B billions.
// One formatter for the memo, flag strings, and anything else the engine
// renders, so the convention cannot drift between surfaces. The web app
// mirrors this in web/src/format.ts.

export function fmtUSD(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'not reported';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  const unit = (value: number, suffix: string): string => {
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    const s = value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    return `${sign}$${s}${suffix}`;
  };
  if (abs >= 1_000_000_000) return unit(abs / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return unit(abs / 1_000_000, 'M');
  if (abs >= 1_000) return unit(abs / 1_000, 'K');
  return `${sign}$${abs.toLocaleString('en-US')}`;
}

// Market caps arrive in $MM units across the pipeline.
export function fmtCapMM(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'n/a';
  return fmtUSD(v * 1_000_000);
}
