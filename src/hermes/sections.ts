// 10-K section extraction from flattened filing text. The three sections that
// carry the card are Business (Item 1), Risk Factors (Item 1A), and MD&A (Item 7).
// Filings are messy: the phrase "Item 1." appears in the table of contents before
// it appears as a heading, so take the LAST plausible start marker in the first
// half of the document and slice to the next item marker after it.

const CAPS = {
  business: 60_000,
  riskFactors: 50_000,
  mdna: 60_000,
} as const;

function findItem(text: string, patterns: RegExp[], from: number): number {
  let best = -1;
  for (const re of patterns) {
    re.lastIndex = from;
    const m = re.exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

// All markers are matched case-insensitively against the flattened text.
const ITEM = {
  i1: [/item\s*1\s*[.:]\s*business/gi, /item\s*1\b(?!\s*[a-b0-9])[\s.:]{0,4}business/gi],
  i1a: [/item\s*1a\s*[.:]\s*risk\s*factors/gi],
  i2: [/item\s*2\s*[.:]\s*properties/gi, /item\s*1b\s*[.:]/gi],
  i7: [/item\s*7\s*[.:]\s*management/gi],
  i7a: [/item\s*7a\s*[.:]/gi, /item\s*8\s*[.:]/gi],
};

export interface Sections {
  business: string;
  riskFactors: string;
  mdna: string;
}

export function extractSections(text: string): Sections {
  // Skip the table of contents: search from 5 percent into the document.
  const from = Math.floor(text.length * 0.05);

  const s1 = findItem(text, ITEM.i1, from);
  const s1a = findItem(text, ITEM.i1a, s1 > -1 ? s1 + 100 : from);
  const s2 = findItem(text, ITEM.i2, s1a > -1 ? s1a + 100 : from);
  const s7 = findItem(text, ITEM.i7, s2 > -1 ? s2 : from);
  const s7a = findItem(text, ITEM.i7a, s7 > -1 ? s7 + 100 : from);

  const slice = (start: number, end: number, cap: number) =>
    start === -1 ? '' : text.slice(start, end === -1 ? start + cap : Math.min(end, start + cap)).trim();

  return {
    business: slice(s1, s1a, CAPS.business),
    riskFactors: slice(s1a, s2, CAPS.riskFactors),
    mdna: slice(s7, s7a, CAPS.mdna),
  };
}
