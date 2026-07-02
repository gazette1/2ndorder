// Dollar convention: M for thousands, MM for millions.

export function fmtFloatMM(v: number | null): string {
  if (v === null) return 'n/a';
  return '$' + Math.round(v).toLocaleString('en-US') + 'MM';
}

export function fmtBand(band: [number, number]): string {
  return `Float band $${band[0].toLocaleString('en-US')}MM to $${band[1].toLocaleString('en-US')}MM`;
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
