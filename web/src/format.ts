// Dollar convention on product surfaces: K thousands, M millions, B billions.
// Decided 2026-08-24 for the equity-research audience: $99M reads as millions
// to most public-markets users, so the CRE-style M/MM convention is retired
// here. Financial documents outside the product keep house style.

import type { CapSource } from './types';

// Provenance wording for a market cap figure, keyed by how it was sized.
export function capSourceLabel(src: CapSource | null): string {
  if (src === 'public_float') return '10-K public float, proxy';
  return 'delayed price x reported shares';
}

// Combined provenance sentence used where a table or band mixes both sources.
export const CAP_PROVENANCE_NOTE =
  'Market cap: delayed price x reported shares (Yahoo, delayed); 10-K public float used as ' +
  'fallback where price is unavailable. Not a licensed market data feed.';

// Market caps arrive in $MM units; render comma-free K/M/B.
// 2540 -> $2.54B, 640 -> $640M, 0.4 -> $400K.
export function fmtCapMM(v: number | null): string {
  if (v === null) return 'n/a';
  return fmtUSD(v * 1_000_000);
}

// Format a raw USD figure with K/M/B units.
// Examples: 236365221 -> $236M, 99448 -> $99.4K, 1795737000 -> $1.8B,
// 14700000000 -> $14.7B. Values under one thousand render in plain dollars.
// Negatives keep the sign outside the dollar mark, like -$31.1M.
export function fmtUSD(v: number | null): string {
  if (v === null) return 'not reported';
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

// Price targets render as plain whole dollars, like $27. Null renders blank.
export function fmtPriceTarget(v: number | null): string {
  if (v === null) return '';
  return '$' + Math.round(v).toLocaleString('en-US');
}

export function fmtBand(band: [number, number]): string {
  return `Market cap band ${fmtCapMM(band[0])} to ${fmtCapMM(band[1])}`;
}

export function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
