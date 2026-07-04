export type Polarity = 'beneficiary' | 'at_risk';
export type Horizon = 'near' | 'mid' | 'long';

// Consequence-tree node. Replaces the old layer-based chain node: nodes now
// carry an order (1st, 2nd, 3rd consequence...), a polarity, and a parent link.
export interface ChainNode {
  id: string;
  parentId: string | null;
  order: number;
  polarity: Polarity;
  name: string;
  mechanism: string;
  logic: string;
  horizon: Horizon;
  searchPhrases: string[];
  filingHits?: number;
  whiteSpace?: boolean;
}

// Old payload shape (pre consequence tree). Kept only so the load-time
// normalizer can accept both shapes without crashing.
export type LegacyLayer = 'enabler' | 'picks_and_shovels' | 'second_order' | 'disrupted';

export interface RawChainNode {
  id: string;
  name: string;
  logic?: string;
  searchPhrases?: string[];
  // New-shape fields, optional on the wire.
  parentId?: string | null;
  order?: number;
  polarity?: Polarity;
  mechanism?: string;
  horizon?: Horizon;
  filingHits?: number;
  whiteSpace?: boolean;
  // Old-shape field.
  layer?: LegacyLayer | string;
}

export interface Alert {
  ticker: string;
  form: string;
  filedAt: string;
  accession: string;
  note: string;
}

export interface OverlayPosition {
  issuer: string;
  valueUSD: number;
  matchedTicker: string | null;
  nodeId: string | null;
  polarity: Polarity | null;
}

export interface Overlay {
  fund: { name: string; cik: string; filedAt: string };
  positions: OverlayPosition[];
  summary: {
    totalPositions: number;
    matched: number;
    onBeneficiary: number;
    onAtRisk: number;
  };
}

export interface FtsHit {
  form: string;
  accession: string;
  filedAt: string;
  docId: string;
}

export interface Candidate {
  cik: string;
  ticker: string;
  name: string;
  nodeId: string;
  ftsHits: number;
  latestHit: FtsHit;
  marketCapMM: number | null;
  capSource: 'price_x_shares' | 'public_float' | null;
  status: 'in_band' | 'filtered_out' | 'scored';
  filterReason?: string;
}

export interface Quote {
  text: string;
  form: string;
  accession: string;
  filedAt: string;
  url: string;
}

export interface SubScore {
  score: number;
  rationale: string;
  quoteIdx: number[];
}

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
  | 'finnhub'
  | 'fmp'
  | 'yahoo'
  | 'stub';

export interface InsiderTx {
  insider: string;
  role: string;
  code: string;
  shares: number;
  price: number;
  valueUSD: number;
  acquiredDisposed: 'A' | 'D';
  date: string;
  accession: string;
}

export interface InsiderSummary {
  window: string;
  netBuyUSD: number;
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
  namedCustomers: string[];
  provenance: Provenance;
}

export type RatingActionKind = 'upgrade' | 'downgrade' | 'initiate' | 'reiterate' | 'target';

export interface RatingAction {
  firm: string;
  action: RatingActionKind;
  fromGrade: string | null;
  toGrade: string;
  priceTargetUSD: number | null;
  date: string;
  url: string;
}

export interface Coverage {
  analystCount: number | null;
  consensusRating: string | null;
  priceTargetMeanUSD: number | null;
  ratingActions: RatingAction[];
  provenance: Provenance;
}

export interface RealityCheck {
  advUSD: number | null;
  daysToBuild: number | null;
  netCashUSD: number | null;
  runwayQuarters: number | null;
  sharesChangePct: number | null;
  shelfOnFile: boolean;
  flags: string[];
  provenance: Provenance[];
}

// ---- Evidence layer (8-K events, holders, proxy, hiring, macro) ----
// Every field is optional: runs made before the evidence layer existed carry
// none of these, and the load-time normalizer defaults them so old runs render
// exactly as before.

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
  board: string; // 'greenhouse' | 'lever'
  slug: string;
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
}

export interface Read {
  ticker: string;
  cik: string;
  exposure: 'direct' | 'adjacent' | 'peripheral';
  eightKCount12m: number;
  quotes: Quote[];
  subscores: {
    optionality: SubScore;
    revenueToOpportunity: SubScore;
    catalystDensity: SubScore;
    managementConviction: SubScore;
    insiderConviction: SubScore;
    customerValidation: SubScore;
  };
}

export interface Thesis {
  ticker: string;
  score: number;
  markdown: string;
}

export interface Rubric {
  weights: Record<string, number>;
  definitions: Record<string, string>;
  exposureGate?: Record<string, number>;
}

export interface RunInfo {
  id: string;
  seed: string;
  createdAt: string;
  capBandMM: [number, number];
  mode: 'live' | 'fixture';
  rubric: Rubric;
  asof: string | null;
  counterOf: string | null;
  // Set when the run came from a pasted news article URL.
  sourceUrl: string | null;
  sourceTitle: string | null;
}

// One company research card in the corpus, built from the company's own 10-K.
// Every claim carries the filing sentence it came from.
export interface CompanyCard {
  cik: string;
  ticker: string;
  name: string;
  source: { form: string; accession: string; filedAt: string; url: string };
  business: string;
  sellsTo: string[];
  namedCustomers: string[];
  namedSuppliers: string[];
  exposures: {
    tag: string;
    stance: 'core_product' | 'active_investment' | 'risk_mention';
    sentence: string;
  }[];
  catalysts: { event: string; date: string | null; sentence: string }[];
  tamClaims: { claim: string; sentence: string }[];
  generatedAt: string;
  model: string;
}

export type CapSource = 'price_x_shares' | 'public_float';

export interface RunPayload {
  run: RunInfo;
  chain: ChainNode[];
  candidates: Candidate[];
  reads: Read[];
  theses: Thesis[];
  dossiers: Dossier[];
  // Scenario-level macro context (FRED, keyless). Null on older runs.
  macro?: MacroContext | null;
}
