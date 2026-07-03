export const CONFIG = {
  // Public float band, USD MM. Float from the 10-K cover (dei:EntityPublicFloat) is a free,
  // filing-audited proxy for market cap; swap in a price feed when one is paid for.
  floatBandMM: [150, 5000] as [number, number],
  // Forms searched for theme exposure. 10-K/10-Q carry strategy language; 8-K carries catalysts.
  ftsForms: '10-K,10-Q,8-K',
  // Look-back window for full-text search, years.
  ftsYears: 2,
  // Max CIKs per chain node taken forward to the float filter (ordered by hit count).
  maxCiksPerNode: 12,
  // Candidates taken into the filing-read stage, ordered by FTS hit count across nodes.
  topKReads: 3,
  // SEC asks for a descriptive User-Agent with a contact address.
  userAgent: 'AdoptionChain/0.1 research russellharrisrei@gmail.com',

  // Reasoning model. Default is fixture mode so the pipeline runs with no setup.
  // Cheap local or hosted open models replace a frontier model here: the task is
  // bounded (structured scoring from pre-extracted evidence, templated drafting).
  //   ollama:  pull a model first, e.g. `ollama pull gemma2:27b`, then LLM_PROVIDER=ollama.
  //   openai:  LLM_PROVIDER=openai, OPENAI_BASE_URL, OPENAI_API_KEY (DeepSeek, Groq, etc).
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'fixture', // 'fixture' | 'ollama' | 'openai'
    model: process.env.LLM_MODEL ?? 'gemma2:27b',
    ollamaHost: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    openaiBaseURL: process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com/v1',
  },

  // Enrichment (src/pipeline/enrich.ts), applied to the read set.
  enrich: {
    // Form 4 look-back and a cap so a heavy filer does not stall the run.
    insiderMonths: 12,
    insiderMaxFilings: 60,
  },

  // Deterministic subscore thresholds, USD. Scaled to small-caps and meant to be argued with:
  // a PM who thinks a $250M-float name needs a larger insider buy to signal can move these.
  scoreThresholds: {
    insiderClusterUSD: 1_000_000, // net open-market buying at or above this, with 2+ buyers, scores 5
    insiderBuyUSD: 250_000, // net buying at or above this scores 4
    govAwardMaterialUSD: 1_000_000, // cumulative federal award dollars at or above this is material
  },
} as const;
