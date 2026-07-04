// Dollar convention: M for thousands, MM for millions.

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

// Market caps render comma-free: $2.54B at billion scale, $640MM below it.
export function fmtCapMM(v: number | null): string {
  if (v === null) return 'n/a';
  if (v >= 1000) {
    const b = v / 1000;
    return '$' + (b >= 100 ? Math.round(b) : b.toFixed(2).replace(/\.?0+$/, '')) + 'B';
  }
  return '$' + Math.round(v) + 'MM';
}

// Format a raw USD figure using the M (thousands) / MM (millions) convention.
// Examples: 236365221 -> $236MM, 99448 -> $99M, 1795737000 -> $1,796MM.
// Values under one thousand render in plain dollars. Negatives keep the sign
// outside the dollar mark, like -$31.1MM.
export function fmtUSD(v: number | null): string {
  if (v === null) return 'not reported';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const mm = abs / 1_000_000;
    const digits = mm < 100 ? 1 : 0;
    return `${sign}$${mm.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}MM`;
  }
  if (abs >= 1_000) {
    const m = abs / 1_000;
    const digits = m < 100 ? 1 : 0;
    return `${sign}$${m.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}M`;
  }
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
