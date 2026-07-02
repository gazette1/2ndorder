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
  };
}

export interface Thesis {
  ticker: string;
  score: number; // 0-100 weighted composite
  markdown: string;
}

export interface Rubric {
  weights: Record<keyof Read['subscores'], number>;
  definitions: Record<keyof Read['subscores'], string>;
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
  reads: Read[];
  theses: Thesis[];
}
