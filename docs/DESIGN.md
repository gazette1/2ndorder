# Adoption Chain: design

An idea-generation engine for a small-cap growth team. An analyst enters a seed thesis. The engine returns ranked, under-covered small-cap candidates, each with a one-page thesis draft in which every factual claim links to the exact filing sentence it came from. The engine produces leverage underneath judgment: it reads filings and drafts arguments, and the analyst tears the drafts apart. Nothing it outputs is a recommendation.

## Why SEC EDGAR

Small-cap coverage is the gap in every paid feed, and it is the reason this tool has a right to exist. EDGAR full-text search covers every filer, is free, and returns the exact document a claim came from, which makes sentence-level citation possible. Paid feeds summarize; filings are the primary source a PM would ask for anyway.

## The five layers

Each layer is a separate pipeline stage that writes its output to disk before the next stage reads it. Every intermediate is a file an analyst can open.

### 1. Chain decomposition (model)
The seed thesis becomes 6 to 10 chain nodes across four fixed layers: enablers, picks and shovels, second-order adopters, and disrupted names. Second-order adopters is where existing companies improve from the new technology; disrupted is the short side of the map and the prompt requires at least one node there. Each node carries the economic logic (who pays whom, which line item inflects) and 2 to 3 search phrases. The phrase rule is the load-bearing design choice: phrases must be language a company would write in its own 10-K, because they go verbatim into full-text search. Analyst language ("humanoid robotics beneficiaries") returns nothing; filing language ("rare earth magnets") returns the supply chain.

### 2. Ticker mapping (EDGAR, no model)
Each phrase runs against EDGAR full-text search over 10-K, 10-Q, and 8-K filings from the last 2 years. Hits aggregate by CIK per node, join to the SEC ticker file, and each company lands on the node where it hit most. The small-cap filter uses public float from the 10-K cover page (dei:EntityPublicFloat) as a market cap proxy: it is free, filing-audited, and available for every domestic filer. Default band is $150MM to $5,000MM, set in config where a PM can argue with it. Companies with no reported float (mostly foreign private issuers and funds) are excluded and labeled, not silently dropped.

### 3. Filing read (EDGAR + model)
Read targets are chosen one per chain node before filling by hit count, so a run reads across the chain (an enabler, an adopter, a disrupted name) rather than clustering on the loudest node. For each target the engine pulls the hit filing, extracts the exact sentences that touch the theme, and asks the model to judge exposure and score the rubric using only those sentences. The model is forbidden to use outside knowledge of the company; if the excerpts do not support a judgment, the instruction is to score low and say so. 8-K count over the trailing 12 months is computed mechanically and handed to the model as an input, not judged by it.

### 4. Non-linearity scoring (no model)
Four subscores, each 0 to 5, each defined in src/rubric.json in language a PM can argue with:
- Optionality, weight 0.35. Does the theme create a business the company does not have today. Weighted highest because non-linear outcomes come from new businesses, not from margin on old ones.
- Revenue-to-opportunity, weight 0.25. Small revenue against a large theme TAM means success moves the whole company.
- Catalyst density, weight 0.20. Dated, observable events inside 18 months.
- Management conviction, weight 0.20. Named programs and committed capex score high; trend name-dropping in risk factors scores low.

The model judges subscores against evidence; the arithmetic stays outside the model. Composite = weighted sum, scaled to 100. Because subscores and weights are stored separately, the UI re-ranks live when a PM moves a weight slider, with no rerun and no model call. That is the point of the design: the rubric is an argument, not a black box.

### 5. Thesis drafting (model)
One page per name, fixed house format, bear case first. The draft prompt receives only the extracted filing sentences as factual sources; every claim carries a citation index that resolves to the exact sentence, its form type, accession number, and SEC URL. Claims without a supporting excerpt must be framed as open questions. House style is enforced in the prompt: no em-dashes, no exclamation points, no superlatives, M for thousands and MM for millions.

## Wiring

- TypeScript end to end; the pipeline is a CLI (npm run stage -- <stage> <slug>), the front end is Vite/React reading a published JSON payload. One language keeps the scaffold small.
- Every model call goes through one adapter (src/lib/fable.ts). With ANTHROPIC_API_KEY set it calls claude-fable-5. Without it, it reads authored fixtures and fails loudly if one is missing. Either way the exact prompt is saved to disk before the call, so any output can be audited against the prompt that produced it.
- Supabase is the intended store (schema in supabase/migrations/0001_init.sql: runs, chain_nodes, candidates, reads, theses, with the rubric frozen per run so past ranks stay reproducible). Both Supabase projects on this account are paused, so the scaffold persists identical shapes to data/runs/<slug>/ as JSON; the swap is a write-path change only.
- EDGAR client throttles to the SEC fair-access guideline and retries the full-text search endpoint, which returns intermittent 500s on well-formed queries (observed during the dry run and fixed with retry and backoff).

## Dry run findings (seed: humanoid robotics reaches commercial deployment 2027-2030)

The run mapped 80 companies, 34 inside the float band, and read three across three layers. What it surfaced is the argument for the design:

1. USA Rare Earth (USAR, enabler, composite 80). The read landed on a June 2026 8-K exhibit: a federal Direct Funding Agreement for new magnet and metal plants with commencement clawback dates of June 30, 2027 and September 30, 2027 and disbursements gated on minimum cumulative magnet purchase commitments. Dated catalysts inside the thesis window, from a filing, with every claim citable.
2. Matthews International (MATW, second-order, composite 16). A true false positive caught by the layer built to catch it. The name screened loudly on warehouse automation language, and the read showed the language was divestiture disclosure: the automation business was sold in December 2025. Keyword mapping promoted it; the filing read rejected it. The thesis draft says so and recommends removal.
3. Kelly Services (KELYB, disrupted, composite 9). The hit document was an earnings 8-K with two boilerplate sentences, so the draft's verdict is that the evidence is too thin to act on. The engine says "insufficient evidence" instead of manufacturing a conclusion.

Two of three drafts are passes. An idea engine that says no most of the time is the behavior a PM should demand from it.

## What is real and what is stubbed in this scaffold

Real: EDGAR full-text search, ticker join, float filter, filing fetch, sentence extraction, 8-K cadence, deterministic scoring, publish, UI.
Stubbed: the three model calls ran in fixture mode because no API key was present in the build environment. The fixtures were authored by the same model against the real prompts and real filing excerpts saved by the pipeline, and the payload is labeled mode: fixture end to end. Setting ANTHROPIC_API_KEY makes the same run live with zero code changes.

## Known limits, next in line

- Full-text search reads only the first result page per phrase (about 100 hits, relevance ranked). Pagination is a parameter away.
- The read covers only the FTS hit document. Disrupted names need the latest 10-K risk factors read alongside it; the KELYB read is the evidence.
- Excerpts from 8-K legal exhibits carry boilerplate (the USAR read shows this). A section-aware extractor for MD&A and risk factors is the highest-value read improvement.
- Under-coverage is proxied by the float band. Analyst-count data would make it explicit; no free complete source exists.
- Float can be stale up to a year (10-K cover date) and one boundary name (MP Materials at $5,000MM) sat exactly on the band edge.
