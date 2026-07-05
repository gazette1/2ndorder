// A node in the consequence map. The map is a tree: the scenario is the root,
// 1st-order nodes hang off it, deeper orders hang off their parent consequence.
export interface ChainNode {
  id: string;
  // Node this consequence follows from. null means it follows directly from the scenario.
  parentId: string | null;
  // 1 = direct consequence, 2 = consequence of a consequence, 3+ = deeper (drill extends).
  order: number;
  polarity: 'beneficiary' | 'at_risk';
  name: string;
  // One line of causal mechanism: who pays whom, which line item moves.
  mechanism: string;
  // One paragraph: the economic logic for why this node benefits (or suffers) if the scenario plays out.
  logic: string;
  // When the consequence becomes observable: near = 0 to 6 months, mid = 6 to 18, long = 18 plus.
  horizon: 'near' | 'mid' | 'long';
  // Exact phrases for EDGAR full-text search. Quoted verbatim, so they must be phrases companies actually write in filings.
  searchPhrases: string[];
  // Filled by the map stage: total FTS hits across the node's phrases.
  filingHits?: number;
  // Logic says the consequence exists but almost no filer writes about it. Where mispricing lives.
  whiteSpace?: boolean;
}

export interface Decomposition {
  nodes: ChainNode[];
  // Broad theme words used to excerpt filing text around hits.
  themeKeywords: string[];
}

// A filing event on a mapped name since the run (or since the last alert check).
export interface Alert {
  ticker: string;
  form: string;
  filedAt: string;
  accession: string;
  note: string;
}

// One 13F position placed on the map.
export interface OverlayPosition {
  issuer: string;
  valueUSD: number;
  matchedTicker: string | null;
  nodeId: string | null;
  polarity: ChainNode['polarity'] | null;
}

export interface Overlay {
  fund: { name: string; cik: string; filedAt: string };
  positions: OverlayPosition[];
  summary: { totalPositions: number; matched: number; onBeneficiary: number; onAtRisk: number };
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
  // Market cap = delayed price x latest reported shares outstanding. Falls back
  // to 10-K public float when either input is missing; capSource says which.
  marketCapMM: number | null;
  capSource: 'price_x_shares' | 'public_float' | null;
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
export type Provenance =
  | 'sec_form4'
  | 'sec_xbrl'
  | 'usaspending'
  | 'sec_fts'
  | 'sec_8k'
  | 'sec_8k_ex99'
  | 'sec_13dg'
  | 'sec_def14a'
  | 'fred'
  | 'job_board'
  | 'openfda'
  | 'fcc_ecfs'
  | 'ferc_elibrary'
  | 'finnhub'
  | 'fmp'
  | 'yahoo'
  | 'stub';

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

// A single sell-side action on the stock. The firm, grade, target, and date are
// available free through aggregators. The underlying bank report is paywalled, so
// url points to where the action was reported (an aggregator or a news search),
// never to the bank PDF, which this tool cannot and does not claim to serve.
export interface RatingAction {
  firm: string; // e.g. Morgan Stanley
  action: 'upgrade' | 'downgrade' | 'initiate' | 'reiterate' | 'target';
  fromGrade: string | null;
  toGrade: string; // e.g. Overweight, Buy, Hold
  priceTargetUSD: number | null;
  date: string;
  url: string; // source of the reported action, not the bank report
}

export interface Coverage {
  analystCount: number | null; // under-coverage lens, not a rubric weight
  consensusRating: string | null; // aggregated, e.g. Overweight
  priceTargetMeanUSD: number | null;
  ratingActions: RatingAction[]; // recent firm upgrades and downgrades with source links
  provenance: Provenance;
}

// The SMID reality check: can the fund actually own it, and will it live.
// Deterministic from free data; every threshold sits in config for a PM to argue.
export interface RealityCheck {
  advUSD: number | null; // trailing 3-month average daily dollar volume
  daysToBuild: number | null; // days to build the config position at the config participation rate
  netCashUSD: number | null; // cash minus total debt (long-term debt concept, approximate)
  runwayQuarters: number | null; // cash / quarterly operating burn; null when operations fund themselves
  sharesChangePct: number | null; // share count change over ~12 months
  shelfOnFile: boolean; // S-3 or 424B5 in the trailing 12 months
  flags: string[]; // human-readable warnings derived from the above
  provenance: Provenance[];
}

// ---- Evidence layer (8-K events, holders, proxy, hiring, macro) ----

export interface CorporateEvent {
  filedAt: string;
  items: Array<{ code: string; label: string }>; // 8-K item codes, decoded
  signal: boolean; // true when any item is thesis-moving (M&A, CEO change, credit, impairment)
  url: string;
  accession: string;
}

// The free stand-in for transcript archives: what management leads with in the
// earnings press release (8-K Item 2.02, EX-99), and how it moved vs last quarter.
export interface EarningsLanguage {
  emphasis: string | null;
  drift: string | null; // quarter-over-quarter language movement, null with only one release
  hedges: string[]; // recurring hedge phrases, quoted verbatim
  releasesRead: number;
  latestFiledAt: string;
  provenance: Provenance;
}

export interface StakeDisclosure {
  form: string; // SC 13D, SC 13G, amendments
  activist: boolean; // 13D reserves the right to push for change; 13G is passive
  holder: string | null; // cover-page reporting person, null when parsing fails
  percent: number | null; // percent of class, null when parsing fails
  filedAt: string;
  url: string;
}

export interface Governance {
  proxyUrl: string;
  filedAt: string;
  ceoCompUSD: number | null;
  relatedParty: string | null; // one sentence, or null when the proxy reports none
  shareholderProposals: number | null;
  notes: string | null; // anything a PM would want flagged from the excerpts
  provenance: Provenance;
}

export interface HiringSnapshot {
  openRoles: number;
  topDepartments: string[]; // "Engineering (14)" style
  board: 'greenhouse' | 'lever';
  slug: string;
  provenance: Provenance;
}

// Sector-regulator signal, routed by SIC: FDA for pharma and devices, FCC for
// telecom, FERC for utilities and pipelines. Null for unregulated sectors.
export interface RegulatorSignal {
  agency: 'FDA' | 'FCC' | 'FERC';
  headline: string;
  items: Array<{ date: string | null; text: string }>;
  provenance: Provenance;
}

export interface MacroSeries {
  id: string; // FRED series id
  label: string;
  latest: number;
  asof: string;
  yoyPct: number | null;
  provenance: Provenance;
}

export interface MacroContext {
  series: MacroSeries[];
  note: string;
}

export interface Dossier {
  ticker: string;
  cik: string;
  insider: InsiderSummary;
  fundamentals: Fundamentals;
  customers: CustomerGraph;
  coverage: Coverage;
  reality?: RealityCheck;
  events?: CorporateEvent[];
  earningsLanguage?: EarningsLanguage | null;
  holders?: StakeDisclosure[];
  governance?: Governance | null;
  hiring?: HiringSnapshot | null;
  regulator?: RegulatorSignal | null;
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
    capBandMM: [number, number];
    mode: 'live' | 'fixture';
    rubric: Rubric;
    // Filings-only backtest: the map searched filings dated on or before this date.
    asof: string | null;
    // Set when this run is the counter-scenario of another run.
    counterOf: string | null;
    // Set when this run was extracted from a pasted news article.
    sourceUrl: string | null;
    sourceTitle: string | null;
  };
  chain: ChainNode[];
  candidates: Candidate[];
  dossiers: Dossier[];
  reads: Read[];
  theses: Thesis[];
  // Scenario-level macro context (FRED, keyless). Null on older runs.
  macro?: MacroContext | null;
}
