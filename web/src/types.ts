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

export interface Dossier {
  ticker: string;
  cik: string;
  insider: InsiderSummary;
  fundamentals: Fundamentals;
  customers: CustomerGraph;
  coverage: Coverage;
  reality?: RealityCheck;
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
}
