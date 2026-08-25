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
  // The measurable company line item this consequence lands on. Absent on
  // runs generated before the field existed.
  kpi?: string;
  // The observable condition that would break this edge. Same optionality.
  falsifier?: string;
}

// The normalized trigger: the event stated precisely before anything is
// mapped. Null or absent on runs generated before the field existed.
export interface Trigger {
  actor: string;
  action: string;
  magnitude: string;
  geography: string;
  timing: string;
  certainty: string;
  reversibility: string;
}

// A stakeholder-reaction row: who is affected, what they are paid to do
// about it. Empty or absent on runs generated before the field existed.
export interface Reaction {
  actor: string;
  incentive: string;
  likelyResponse: string;
  timing: string;
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
  kpi?: string;
  falsifier?: string;
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
  | 'openfda'
  | 'fcc_ecfs'
  | 'ferc_elibrary'
  | 'federalreserve'
  | 'census_cbp'
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
  // Form 144 proposed-sale notices, trailing 90 days: leads the executed
  // Form 4 sale. Optional; absent on runs made before the field existed.
  form144Count90d?: number;
  form144LatestDate?: string | null;
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
  // The position the days-to-build math assumes, and where it came from.
  // Absent on runs generated before the fields existed.
  positionUSD?: number;
  positionBasis?: string;
  // Position as a share of market cap.
  ownershipPct?: number | null;
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
  // Direct link to the EX-99 exhibit (press release or investor deck), when found.
  exhibitUrl?: string | null;
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

// Sector-regulator signal, routed by SIC: FDA for pharma and devices, FCC for
// telecom, FERC for utilities and pipelines. Absent for unregulated sectors.
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

// Committee stance from the latest FOMC minutes.
export interface FomcStance {
  date: string;
  stance: string;
  provenance: Provenance;
}

// Industry size from Census County Business Patterns, a floor-check against
// TAM claims quoted in filings.
export interface IndustryAnchor {
  naics: string;
  label: string;
  establishments: number;
  employees: number;
  annualPayrollUSD: number;
  year: number;
  provenance: Provenance;
}

export interface MacroContext {
  series: MacroSeries[];
  fomc?: FomcStance | null;
  industry?: IndustryAnchor | null;
  note: string;
}

// Expectations proxies: what the market already appears to believe, from free
// delayed data. Proxies, honestly labeled; not consensus estimates.
export interface ExpectationsCard {
  priceChange3moPct: number | null; // delayed price, ~3 months back to latest
  pct52wRange: number | null; // where price sits in the 52-week range, 0 low to 100 high
  psRatio: number | null; // market cap / trailing revenue, null when revenue absent
  note: string; // the honest caption rendered with the card
  provenance: Provenance;
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
  expectations?: ExpectationsCard | null;
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
  // TRACE-lite: the normalized trigger and stakeholder reactions. Null or
  // empty on runs generated before the fields existed.
  trigger?: Trigger | null;
  reactions?: Reaction[];
  candidates: Candidate[];
  reads: Read[];
  theses: Thesis[];
  dossiers: Dossier[];
  // Scenario-level macro context (FRED, keyless). Null on older runs.
  macro?: MacroContext | null;
}
