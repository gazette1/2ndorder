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
// Punctuation after the item number is optional: filings write "Item 1.
// Business", "Item 1: Business", and plain "Item 1 Business".
const ITEM = {
  i1: [/item\s*1\s*[.:]?\s*business/gi],
  i1a: [/item\s*1a\s*[.:]?\s*risk\s*factors/gi],
  i2: [/item\s*2\s*[.:]?\s*propert/gi, /item\s*1b\s*[.:]?\s*unresolved/gi, /item\s*1c\s*[.:]?\s*cybersecurity/gi],
  i7: [/item\s*7\s*[.:]?\s*management/gi],
  i7a: [/item\s*7a\s*[.:]?\s*quantitative/gi, /item\s*8\s*[.:]?\s*financial/gi],
};

export interface Sections {
  business: string;
  riskFactors: string;
  mdna: string;
}

// A real section runs thousands of characters; a table-of-contents row runs
// dozens. When a start/end pair lands closer together than this, we matched
// the TOC (which can sit past any fixed skip offset), so advance and retry.
const MIN_SECTION = 2500;

function findSpan(text: string, startPats: RegExp[], endPats: RegExp[], from: number): { start: number; end: number } {
  let searchFrom = from;
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = findItem(text, startPats, searchFrom);
    if (start === -1) return { start: -1, end: -1 };
    // search for the end marker from just past the start match itself; a TOC
    // row's end marker sits ~18 chars away and must be seen, not jumped over
    const end = findItem(text, endPats, start + 8);
    if (end === -1) return { start, end: -1 };
    if (end - start >= MIN_SECTION) return { start, end };
    searchFrom = end; // TOC row: both markers within a line of each other
  }
  return { start: -1, end: -1 };
}

export function extractSections(text: string): Sections {
  const from = Math.floor(text.length * 0.02);

  const biz = findSpan(text, ITEM.i1, ITEM.i1a, from);
  const risk = findSpan(text, ITEM.i1a, ITEM.i2, biz.start > -1 ? biz.start : from);
  const mdna = findSpan(text, ITEM.i7, ITEM.i7a, risk.end > -1 ? risk.end : from);

  const slice = (start: number, end: number, cap: number) =>
    start === -1 ? '' : text.slice(start, end === -1 ? start + cap : Math.min(end, start + cap)).trim();

  return {
    business: slice(biz.start, biz.end, CAPS.business),
    riskFactors: slice(risk.start, risk.end, CAPS.riskFactors),
    mdna: slice(mdna.start, mdna.end, CAPS.mdna),
  };
}
