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
  model: 'claude-fable-5',
} as const;
