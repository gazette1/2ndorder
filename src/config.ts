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
  // Candidates taken into the filing-read stage, node-diversified then by hit count.
  topKReads: 5,
  // SEC asks for a descriptive User-Agent with a contact address.
  userAgent: 'AdoptionChain/0.1 research russellharrisrei@gmail.com',

  // Reasoning model. DeepSeek V4-Flash is the default backend: cheap, hosted, and
  // strong enough that its decompose phrases actually hit EDGAR (an 8B local model
  // was not). With OPENAI_API_KEY present the pipeline uses it automatically; with no
  // key it falls back to fixtures so the repo still runs with zero setup. The task is
  // bounded (structured scoring from pre-extracted evidence, templated drafting), so a
  // cheap model is adequate. Force a provider with LLM_PROVIDER.
  //   openai:  OPENAI_API_KEY (and OPENAI_BASE_URL for a non-DeepSeek host).
  //   ollama:  LLM_PROVIDER=ollama and pull a model first, e.g. `ollama pull gemma4`, then set LLM_MODEL.
  llm: {
    provider: process.env.LLM_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'fixture'), // 'fixture' | 'ollama' | 'openai'
    model: process.env.LLM_MODEL ?? 'deepseek-v4-flash',
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
