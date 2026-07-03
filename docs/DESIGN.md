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

## Enrichment: per-candidate dossier (added after the first build)

A new `enrich` stage runs after `map`, on the same names the `read` stage will cover (target selection is shared in `src/pipeline/targets.ts`, so the two stages never diverge). It assembles a `dossier.json` per candidate from four keyless, complete, free sources, and every block carries a provenance tag so the UI marks filing-grade data apart from rate-limited context.

- Insider conviction (SEC Form 4). For each candidate the stage pulls Form 4 filings over the trailing 12 months, parses the non-derivative transactions, and nets open-market buys (code P) against sales (code S). Grants, option exercises, gifts, and tax withholding are excluded because they do not express conviction. Filings from a reporting owner who is neither an officer nor a director are dropped, so the signal is founder and management action, not a fund distributing stock. This directly answers the "track founders and CEOs" brief.
- Fundamentals (SEC XBRL company facts). Latest annual revenue (with the prior year for a growth read), net income, R&D, and cash, from the same XBRL API the float filter already uses. This is the density spine: it quantifies the revenue-to-opportunity story instead of asserting it.
- Customer graph (USASpending.gov plus reverse-citation). The government arm is federal award dollars from USASpending, keyless and complete back to 2007, queried in two groups because the API rejects contract and assistance award codes in one request. The commercial arm is reverse-citation: a full-text search for the company name across other filers, counting distinct companies that name it as a supplier or partner. Named enterprise customers are extracted by the read model from the filing text in live mode. Buyers are labeled government, enterprise, or unproven.
- Sell-side coverage (aggregator, stubbed). Analyst count is the under-coverage lens: few analysts plus a high composite is the sweet spot the product hunts for. The block also carries consensus rating, mean price target, and recent firm rating actions (who upgraded or downgraded, to what grade, on what date). This is the honest edge of the sell-side ask: the firm, grade, target, and date are free through aggregators like Finnhub and FMP, but the underlying bank report is proprietary and paywalled. The tool shows the action and links to where it was reported (a search or aggregator), never to the bank PDF, which it cannot and does not claim to serve. Seam: set FINNHUB_API_KEY to go live; without it an authored fixture demonstrates the shape, tagged stub so the UI marks it not live.

The dossier feeds two consumers. The `read` model receives it as context (so a thesis can cite an insider buy or a federal award) and returns any named customers it finds. The `score` stage computes two new deterministic dimensions from it.

## Rubric, six dimensions

Two dimensions were added, both computed deterministically from the dossier in `src/pipeline/score.ts`, so a PM sees a formula rather than a model's mood:

- Insider conviction (weight 0.10). A ladder over trailing-12-month net open-market dollars and distinct buyers, thresholds in config so a PM can argue them. A cluster buy of size scores 5; heavy net selling scores 0.
- Customer validation (weight 0.20). Federal award dollars, named enterprise customers, and reverse-citation count. Deliberately theme-agnostic: it measures customer proof, not theme-fit. Theme-fit stays in optionality and revenue-to-opportunity.

The four model-judged dimensions were re-weighted to make room (optionality 0.25, revenue-to-opportunity 0.20, catalyst density 0.15, management conviction 0.10). Analyst-estimate count is not a weight; coverage is opportunity, not quality, so it is a displayed field and a sort lens. Because the composite normalizes by the sum of weights, the "argue with the weights" panel re-ranks live over all six dimensions with no rerun.

The theme-agnostic choice on customer validation is deliberate and shows up in the dry run below. It is the kind of design decision a PM should be handed explicitly, not buried.

## Wiring

- TypeScript end to end; the pipeline is a CLI (npm run stage -- <stage> <slug>), the front end is Vite/React reading a published JSON payload. One language keeps the scaffold small.
- Every model call goes through one provider-agnostic adapter (src/lib/llm.ts), selected by LLM_PROVIDER. The default is a local or hosted open model, not a frontier model: `ollama` runs a pulled model (for example gemma2:27b) locally for free, and `openai` targets any OpenAI-compatible endpoint (DeepSeek, Groq, Together) via a base URL and key. The reasoning here is bounded (structured scoring from pre-extracted evidence, and templated drafting under a fixed format with the rubric arithmetic outside the model), so a cheap open model is adequate on the merits, not only on cost. `fixture` is the default and reads authored fixtures, failing loudly if one is missing. The exact prompt is saved to disk before every call, so any output can be audited against the prompt that produced it. The adapter is plain fetch, no SDK dependency.
- Supabase is the intended store (schema in supabase/migrations/0001_init.sql: runs, chain_nodes, candidates, reads, theses, with the rubric frozen per run so past ranks stay reproducible). Both Supabase projects on this account are paused, so the scaffold persists identical shapes to data/runs/<slug>/ as JSON; the swap is a write-path change only.
- EDGAR client throttles to the SEC fair-access guideline and retries the full-text search endpoint, which returns intermittent 500s on well-formed queries (observed during the dry run and fixed with retry and backoff).

## Web application

The tool is a logged-in web app with a search front door, not only a CLI. A thin API server (server/api.ts, node:http, no framework) exposes login, a run list, run fetch, and search. The front end gates on a session, takes a free-text query (a thesis, theme, or company), and renders results in the same chain, table, dossier, and thesis views.

- Search maps a query to a run. If a cached run matches by slug or seed overlap, it returns instantly. Otherwise, with a model wired, it runs the full pipeline asynchronously and the front end polls until ready. In fixture mode a novel query returns a plain needs_model message rather than failing mid-run, because there are no fixtures for an unseen theme.
- The pipeline was refactored so the CLI and the server share one orchestrator (src/pipeline/orchestrate.ts) and one payload builder (src/pipeline/payload.ts). The server is not a parallel reimplementation; it calls the same stages.
- Filings are the deliverable the user can download. Every candidate and every cited sentence carries its exact SEC document URL, so the app links straight to the primary documents. There is no proxy or scraping; the links go to sec.gov.
- Auth is a mock bearer token so the shape is real and the app runs end to end. Production swaps in Supabase Auth, which the paused project already supports. The front end also falls back to the static published payload if the API is not running, so a reviewer can open it with no server.

## Positioning

This does not beat Bloomberg and does not try to. The wager, in the shape of TrialEdge, is that a focused tool can be worth a license if it is close enough on a specific job Bloomberg under-serves: idea generation over under-covered small-caps, with every claim linked to the filing sentence behind it, plus the coverage and insider signal a growth analyst actually acts on. The sell-side reports themselves stay behind Bloomberg's and the banks' paywalls; what this adds is the auditable chain from a theme to a ranked small-cap to the exact evidence, on names the terminal's users skip.

## Dry run findings (seed: humanoid robotics reaches commercial deployment 2027-2030)

The run mapped 80 companies, 34 inside the float band, and enriched and read three across three layers. The enrichment sources are live (EDGAR and USASpending, keyless); only the three model calls run from authored fixtures. Composite scores after the six-dimension rubric: USAR 73, MATW 36, KELYB 29.

1. USA Rare Earth (USAR, enabler, composite 73). The read landed on a June 2026 8-K exhibit: a federal Direct Funding Agreement with commencement clawback dates of June 30, 2027 and September 30, 2027. The dossier makes the thesis concrete and honest at once. Fundamentals: $1.6MM revenue against a $297.6MM net loss and $360MM of cash, the pre-commercial profile the revenue-to-opportunity dimension rewards. Customer graph: a real but small $99M Department of Defense contract on USASpending. Insider: net selling of $31.1MM over the year, so insider conviction scores 0, with the nuance that the most recent director action was a $2.1MM open-market buy above the earlier sale price. The engine flags the negative signal; the analyst reads the detail.
2. Matthews International (MATW, second-order, composite 36). A true false positive, and now a sharper one. The automation business was sold in December 2025, so the theme dimensions collapse. The customer graph shows $236MM of federal awards, which would look like strong validation until you read the awards: Department of Veterans Affairs memorialization contracts, entirely off-theme. This is the theme-agnostic customer-validation choice earning its keep: the score is honest that the company has real government revenue, the thesis states plainly that it is unrelated to robotics, and the near-zero theme dimensions hold the composite well below USAR. No single dimension decides; the blend plus the bear-first narrative do.
3. Kelly Services (KELYB, disrupted, composite 29). The hit document was an earnings 8-K with two boilerplate sentences, so the draft's verdict is still that the theme evidence is too thin to act on. The dossier adds a useful reframe for a disrupted name: $558MM of Department of Health and Human Services staffing awards is exactly the billable base automation would pressure, and the CEO made an open-market purchase even as net insider activity was slightly negative. The engine says "insufficient theme evidence" instead of manufacturing a conclusion, and hands the analyst the customer and insider context to start the follow-up.

Two of three drafts are passes. An idea engine that says no most of the time, and shows its work when it does, is the behavior a PM should demand from it.

## What is real and what is stubbed in this scaffold

Real: EDGAR full-text search, ticker join, float filter, filing fetch, sentence extraction, 8-K cadence, Form 4 insider parsing, XBRL fundamentals, USASpending federal awards, reverse-citation, the two deterministic rubric dimensions, deterministic composite, publish, UI. The enrichment layer runs live against real data even in fixture mode, because its sources are keyless.
Stubbed: the three model calls (read scoring of the four judged dimensions, and thesis drafting) ran in fixture mode because LLM_PROVIDER defaults to fixture. The fixtures were authored against the real prompts, the real filing excerpts, and the real dossiers the pipeline saved, and the payload is labeled mode: fixture. Sell-side coverage is stubbed behind a seam (an authored fixture stands in until FINNHUB_API_KEY is set). Web-app login is a mock session, and novel-query search needs a model wired. Setting LLM_PROVIDER (ollama or openai) plus the coverage key makes the same run fully live with zero code changes; Ollama is installed on this machine, so `ollama pull gemma2:27b` and `LLM_PROVIDER=ollama` is the shortest path to a live local run.

## Known limits, next in line

- Full-text search reads only the first result page per phrase (about 100 hits, relevance ranked). Pagination is a parameter away.
- The read covers only the FTS hit document. Disrupted names need the latest 10-K risk factors read alongside it; the KELYB read is the evidence.
- Excerpts from 8-K legal exhibits carry boilerplate (the USAR read shows this). A section-aware extractor for MD&A and risk factors is the highest-value read improvement.
- Customer-name matching against USASpending is token-overlap on cleaned names, so a subsidiary that contracts under a different legal name (USA Rare Earth Magnets LLC versus USA Rare Earth Inc) can be missed. The large federal funding vehicle behind USAR did not surface as an award, only the $99M contract did; a recipient-hierarchy lookup would catch parent and child entities.
- Customer validation is theme-agnostic by design, so a name with large unrelated government revenue (MATW) scores high on that one dimension. This is intended and documented, and the argue-with-weights panel lets a PM neutralize it, but a theme-relatedness filter on awards would sharpen it.
- Insider parsing nets open-market P and S codes only and reads the primary Form 4 document; multi-owner joint filings and derivative-only filings are simplified.
- Sell-side coverage is stubbed behind a fixture; it needs FINNHUB_API_KEY to go live, and even live it carries firm plus grade plus target only, never the paywalled bank report.
- Web-app auth is a mock bearer token, and novel-query search needs a model provider set; both are seams, not finished production.
- Ollama is installed but no model is pulled yet, so the live local path is wired and typechecked but was not exercised end to end this session; a model pull is a multi-GB download left to the operator.
- Float can be stale up to a year (10-K cover date) and one boundary name (MP Materials at $5,000MM) sat exactly on the band edge.
