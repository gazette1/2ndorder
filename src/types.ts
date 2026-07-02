export type Layer = 'enabler' | 'picks_and_shovels' | 'second_order' | 'disrupted';

export interface ChainNode {
  id: string;
  layer: Layer;
  name: string;
  // One paragraph: the economic logic for why this node benefits (or suffers) if the seed thesis plays out.
  logic: string;
  // Exact phrases for EDGAR full-text search. Quoted verbatim, so they must be phrases companies actually write in filings.
  searchPhrases: string[];
}

export interface Decomposition {
  nodes: ChainNode[];
  // Broad theme words used to excerpt filing text around hits.
  themeKeywords: string[];
}

export interface FtsHit {
  form: string;
  accession: string;
  filedAt: string;
  docId: string;
}

export interface Candidate {
  cik: string; // 10-digit zero-padded
  ticker: string;
  name: string;
  nodeId: string;
  ftsHits: number;
  latestHit: FtsHit;
  publicFloatMM: number | null;
  status: 'in_band' | 'filtered_out' | 'scored';
  filterReason?: string;
}

export interface Quote {
  // Exact sentence lifted from the filing. The thesis draft may cite only these.
  text: string;
  form: string;
  accession: string;
  filedAt: string;
  url: string;
}

export interface SubScore {
  score: number; // 0-5
  rationale: string;
  quoteIdx: number[]; // indexes into Read.quotes backing this subscore
}

// The read model judges these four against filing excerpts.
export interface ModelSubscores {
  optionality: SubScore;
  revenueToOpportunity: SubScore;
  catalystDensity: SubScore;
  managementConviction: SubScore;
}

// These two are computed deterministically from the dossier in the score stage,
// so a PM sees a formula, not a model's mood. quoteIdx stays empty; the evidence
// lives in the dossier, not the filing excerpts.
export interface DeterministicSubscores {
  insiderConviction: SubScore;
  customerValidation: SubScore;
}

export interface Read {
  ticker: string;
  cik: string;
  exposure: 'direct' | 'adjacent' | 'peripheral';
  eightKCount12m: number;
  quotes: Quote[];
  // Four model dimensions after read, six after the score stage merges the deterministic pair.
  subscores: ModelSubscores & Partial<DeterministicSubscores>;
}

// ---- Enrichment: the per-candidate dossier (src/pipeline/enrich.ts) ----

// A source tag rides on every enriched block so the UI can mark filing-grade
// data apart from rate-limited context. 'stub' means the seam is wired but no key.
export type Provenance = 'sec_form4' | 'sec_xbrl' | 'usaspending' | 'sec_fts' | 'finnhub' | 'stub';

export interface InsiderTx {
  insider: string;
  role: string; // officer title or Director
  code: string; // Form 4 transaction code: P open-market buy, S open-market sale, A grant, M option exercise
  shares: number;
  price: number;
  valueUSD: number;
  acquiredDisposed: 'A' | 'D';
  date: string;
  accession: string;
}

export interface InsiderSummary {
  window: string; // e.g. "trailing 12 months"
  netBuyUSD: number; // open-market buys minus sales
  buyCount: number;
  sellCount: number;
  distinctBuyers: number;
  transactions: InsiderTx[];
  provenance: Provenance;
}

export interface Fundamentals {
  revenueUSD: number | null;
  revenuePriorUSD: number | null;
  netIncomeUSD: number | null;
  rdExpenseUSD: number | null;
  cashUSD: number | null;
  asOf: string | null;
  provenance: Provenance;
}

export interface GovAward {
  awardId: string;
  agency: string;
  amountUSD: number;
  recipientMatched: string;
}

export interface ReverseCite {
  cik: string;
  name: string;
  form: string;
  filedAt: string;
}

export interface CustomerGraph {
  govAwards: GovAward[];
  govAwardTotalUSD: number;
  reverseCites: ReverseCite[];
  reverseCiteCount: number;
  namedCustomers: string[]; // named enterprise customers, populated by the read model in live mode
  provenance: Provenance;
}

export interface Estimates {
  analystCount: number | null; // under-coverage lens, not a rubric weight
  provenance: Provenance;
}

export interface Dossier {
  ticker: string;
  cik: string;
  insider: InsiderSummary;
  fundamentals: Fundamentals;
  customers: CustomerGraph;
  estimates: Estimates;
}

export interface Thesis {
  ticker: string;
  score: number; // 0-100 weighted composite
  markdown: string;
}

export interface Rubric {
  weights: Record<string, number>;
  definitions: Record<string, string>;
}

export interface RunPayload {
  run: {
    id: string;
    seed: string;
    createdAt: string;
    floatBandMM: [number, number];
    mode: 'live' | 'fixture';
    rubric: Rubric;
  };
  chain: ChainNode[];
  candidates: Candidate[];
  dossiers: Dossier[];
  reads: Read[];
  theses: Thesis[];
}
