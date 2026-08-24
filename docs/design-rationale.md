# Corollary: complete design rationale for the co-construction agent

You are reading the handoff from the agent that built this system. Every
feature below is listed with what it does, why it is designed that way, and
where it lives. Nothing here is aspirational; this is the system as it runs
today at corollaryresearch.com (branch go-live-2026-08-01). Where a decision
came from a specific failure, the failure is named, because those lessons are
constraints on any redesign. Companion documents: pipeline-export.md (one
real run with every exact prompt), trace-gap.md (the agreed upgrade map),
data-sources.md (source matrix), trowe-demo.md (the live demo plan).

## 1. What this is and the one sentence that governs it

A scenario consequence-mapping engine for small and mid-cap fundamental
equity research. A PM types a scenario in plain language; the engine maps
first, second, and third order consequences, surfaces under-covered names on
each node, and drafts theses in which every claim cites the exact SEC filing
sentence behind it. The governing rule, from which most design decisions
derive: **no claim without a primary-source sentence, and every number
carries its provenance.** The product ranks and flags; it never asserts a
recommendation. Positioning language: it converts events into transparent
causal maps and makes the reasoning inspectable. Never "AI predicts stocks."

Naming: built as "Adoption Chain" (the working name, still the repo name
2ndorder and package name adoption-chain), productized as "Corollary"
(corollaryresearch.com): a corollary is what follows from something already
established.

## 2. Architecture at a glance

One node process (server/api.ts, node:http, no framework) serves the
landing page (/), the built React app (/app), media, data, and the JSON API
(/api). The pipeline (src/pipeline) runs inside the same process for live
runs, or via CLI (scripts). Persistent state is the filesystem: runs in
data/runs/<slug>/ as stage-named JSON artifacts, the company corpus in
data/corpus/. No database in the hot path (Supabase project exists with
schema, unused by the server; landing zone for later auth and billing).

Why filesystem-first: every stage writes its artifact to disk, so a failed
run resumes from the last completed stage, every prompt is auditable after
the fact, and the API can serve partial results mid-run. The jobs table is
in-memory (Map); a restart loses job STATUS but not completed stage output.

Deployment today: the server runs on the owner's PC on port 8731 behind a
Cloudflare named tunnel (corollary-prod); DNS is proxied CNAMEs to the
tunnel. A Dockerfile exists for Railway migration (multi-stage, corpus baked
into the image, runs on a volume, demo runs seeded on first boot because a
fresh volume is empty and an empty app looks broken). Known limit, stated in
DEPLOY.md: the site is down when the PC sleeps.

Models: two tiers routed per task (src/config.ts llm block). Heavy
(currently deepseek-v4-pro; previously kimi-k2.7 on Moonshot until that
account suspended on balance) does open-ended reasoning: scenario
decomposition, article distillation, counter-scenario inversion, drill.
Light (deepseek-v4-flash) does bounded work: filing reads against
pre-extracted excerpts, templated thesis drafting, corpus carding, evidence
extraction. Why two tiers: the bounded tasks are scaffolded enough that a
cheap model is adequate (validated empirically; an 8B local model was not,
its search phrases missed EDGAR), and the cost difference is roughly 3x.
Spend is tracked from per-call token usage against published pricing
(src/lib/llm.ts); long batch jobs take a budget argument and stop at it.
Every prompt is written to data/runs/<slug>/prompts/ before the call. The
adapter is OpenAI-compatible and provider-agnostic on purpose; for
institutional conversations the line is "model-agnostic, can run through
your approved environment," and it is true.

House style is enforced in code, not just asked for in prompts: deSlop()
post-processes every model output (em-dashes to commas, en-dash ranges to
"to") because models honor style rules inconsistently. A separate hard
lesson (the $46M incident): prompt INPUTS carry exact dollars
($45,616, never "$46M"), because a model once misread the house convention
M-for-thousands as millions, got confused, and leaked its deliberation into
a published thesis. Output formatting rules stay in the prompt; input facts
stay literal.

## 3. The pipeline, stage by stage, with rationale

Order (src/pipeline/orchestrate.ts): decompose -> macro -> map -> enrich ->
read -> score -> draft, then optionally counter. Stages communicate only
through disk artifacts.

### 3.1 Decompose (heavy model)

Turns the seed into 10-16 ChainNodes: {parentId, order 1-3, polarity
beneficiary|at_risk, name, mechanism, logic, horizon near|mid|long,
searchPhrases}. Both polarities are mandatory; a map with only winners is
marketing, not analysis. searchPhrases are the bridge to evidence: short,
common filing phrases. Hard-won tuning: specific compound phrases
("harmonic drive gear") returned zero EDGAR hits; the recall-first rule is
short common terms, and the read stage filters precision back in. Known
weakness (agreed in trace-gap.md): orders are hop-based, not
behavior-based; the redesign should redefine them as mechanical effect /
incentivized response / new equilibrium, add trigger normalization, and a
KPI-termination rule.

### 3.2 Macro context (light model + keyless feeds)

The model picks 2-4 series from a fixed FRED whitelist (never invents
series ids) plus optionally one NAICS from a fixed menu; the run gets
latest values, YoY, the cached FOMC stance (summarized once per FOMC cycle,
not per run), and a Census CBP industry-size anchor as a TAM floor-check.
Why whitelists: model-chosen-from-menu is the pattern used everywhere
choice is needed; free generation of identifiers produces fabrication.
Why FRED mirror instead of the BLS API: keyless and unmetered versus a
25-request-per-day keyless cap.

### 3.3 Map (deterministic, no model)

Each node's phrases run against SEC full-text search (quoted, retried on
transient 500s, which efts.sec.gov emits on valid queries). Hits map to
CIKs, first-listed ticker per CIK (this rule kills warrant tickers), then a
market-cap filter to the band (config capBandMM [150, 5000] $MM). Market
cap = delayed Yahoo price x SEC-reported shares outstanding, 10-K public
float as fallback, with capSource recorded; the product labels this
"delayed price x reported shares, not a licensed feed" everywhere it
appears. Why not float: the user directed market cap; why the provenance
label: honesty is the differentiation. Nodes whose phrases return at most
whiteSpaceMaxHits (4) total hits are flagged whiteSpace: the logic says the
consequence exists and almost nobody writes about it yet; that flag is a
feature, not a failure. maxCiksPerNode 12 caps fan-out.

Failure encoded here: the SEC ticker map cache froze in July and tickers
drifted (CGEH renamed CEPL and appeared in a demo table). The cache must be
refreshed on a schedule; 64 corpus entries were re-keyed when this was
found. Any redesign inherits the rule: validate visible tickers against the
current SEC map before anything user-facing ships.

### 3.4 Selection (deterministic)

From in-band candidates, selectReadTargets picks topKReads (12) diversified
across nodes, ranked by a size-aware score (FTS hits normalized by sqrt of
market cap). Why: raw hit counts always surface mega-caps; dividing by
sqrt(cap) is the crudest defensible way to make a $200MM name with 8
mentions outrank a $4B name with 20. An exposure gate later demotes what
this lets through. Why 12 reads: a read costs about two cents, so depth is
not the constraint; PM attention is.

### 3.5 Enrich (mostly deterministic, two light-model calls)

Builds a dossier per selected candidate. Everything is free and public, and
each block carries a Provenance tag rendered in the UI, with 'stub' for
seams that exist but have no key (sell-side coverage via Finnhub). The
blocks, each with its reason for existing:

- Insider (Form 4 + Form 5 same parser): net OPEN-MARKET dollars only;
  P and S codes; grants, exercises, gifts, withholding excluded because
  only purchases and sales express conviction. Officers and directors only
  (a 10 percent fund distributing stock is not management signal). Form
  144 notices counted trailing 90 days as the leading indicator ahead of
  the executed Form 4. NaN lesson: footnote text appears in numeric XML
  fields; coerce with Number.isFinite or one bad filing poisons the JSON.
- Fundamentals (XBRL companyconcept): revenue + prior year, net income,
  R&D, cash; multiple tag fallbacks per concept because filers vary.
- Customer graph: USASpending federal awards (real revenue evidence) plus
  reverse-cites (who else names this company in filings; weak but honest
  evidence of commercial relationships, self-cites dropped).
- Reality check, the SMID-specific layer: dollar ADV, days-to-build a
  $5MM position at 15 percent participation, net cash, runway quarters,
  12-month share-count change, shelf on file. Every threshold lives in
  config as a named assumption "a PM can argue with"; that phrase is the
  design intent. Flags demote; they do not delete, except that flagged
  names must never LEAD anything user-facing.
- Events: 8-K item codes decoded deterministically from the submissions
  feed (no model needed to classify a 5.02), signal flag on thesis-moving
  items, EX-99 exhibit links resolved for the recent material ones.
- Earnings language (light model): reads the two latest earnings press
  releases (EX-99 on Item 2.02 8-Ks) for what management leads with, QoQ
  drift, and verbatim hedge phrases. This is the free stand-in for paid
  transcripts and is labeled "press releases, not call transcripts"
  everywhere. It has caught real signal (leads with adjusted EBITDA,
  buries an $83MM net loss).
- Holders: 13D/13G on the subject company's feed, activist flag on 13D,
  cover-page percent parse; nulls kept with links when parsing fails.
- Governance (light model): DEF 14A targeted excerpts (comp table,
  related-party, proposals anchors) because proxies run hundreds of pages;
  extraction only from excerpts, honest nulls otherwise.
- Sector regulator, routed by SIC from the SEC submissions record: FDA
  (drug approvals, 510(k)s, recalls; name matching falls back to a
  first-word wildcard because FDA abbreviates sponsors, KARYOPHARM
  THERAPS), FCC ECFS docket presence, FERC eLibrary. Unregulated sectors
  get no section rather than an empty one.
- Hiring: Greenhouse/Lever public board probes by name-derived slug; a
  null means no board found, not not hiring, and the caption says so.

The honest-nulls pattern is uniform: absence of data renders as an explicit
statement of absence, never silently and never faked.

### 3.6 Read (light model)

Fetches actual filing text for each candidate, extracts excerpts around the
node phrases, and asks the model for: exposure grade (direct, adjacent,
peripheral), quoted sentences with document metadata, and subscores with
rationales on the rubric's read dimensions. Thin-read fallback: if a
candidate yields fewer than minExcerptsBeforeFallback (6) excerpts (typical
when the only hits are an earnings 8-K), the latest 10-K sections are
pulled as additional evidence. Why exposure grades exist: phrase matching
sneaks in keyword-adjacent names (a water utility on a bank-consolidation
run); the grade is the filter, and showing a graded-down name with its
grade is more credible than hiding it.

### 3.7 Score (deterministic arithmetic)

Composite 0-100 from rubric weights (src/rubric.json). Two dimensions are
pure arithmetic against config thresholds (insider net dollars, government
award dollars); the rest come from the read subscores. The rubric ships in
the payload and renders in the UI and memo because a score nobody can
recompute is an assertion, not an analysis. Agreed future change
(trace-gap.md): present as 1-5 bands with explanations; fake precision
(87.3) invites the wrong argument.

### 3.8 Draft (light model)

One thesis per read name, fixed house format, BEAR CASE FIRST, then
business, chain position, customer graph, insider signal, street view,
non-linear case, evidence bullets, sizing and survivability, what would
change our mind. Every filing claim carries [n] citations resolving to
exact sentences with SEC links; dossier facts carry source tags. Bear-first
is the product's tone: written for an analyst who will tear it apart. The
prompt forbids meta-commentary (the deliberation-leak incident) and
under-600-words padding.

### 3.9 Counter-scenario (heavy model, automatic)

Inverts the seed into the strongest disconfirming scenario and runs a full
second pipeline pass. Runs WITHOUT being asked on article runs; one click
otherwise. Rationale: names that survive both maps are robust ideas; names
that flip are trades on the scenario. This is the half of the adversarial
pass that exists; the per-thesis counterfactual does not yet.

### 3.10 Article runs

Paste a news URL: fetch and extract text (paragraph-first, honest errors on
bot-walled sites), heavy model distills the single investable scenario,
then full run plus auto-counter, with the source link rendered as a badge.
Serves the payload as soon as the base run lands rather than waiting for
the counter (a completed bull map once hid for 15 minutes behind its still-
running bear map; that gate was the bug).

### 3.11 Drill and overlay and alerts

Drill: deepen one node with the heavy model (the live-demo-friendly model
moment, minutes not tens of minutes). Overlay: parse a fund's 13F and mark
which candidates it already holds (for the gift workflow: prefer names the
fund does NOT hold). Alerts: re-check a run's names for new filings on
demand.

## 4. The corpus (Hermes)

data/corpus: 5,449 US filers carded from their latest 10-K (or S-1/S-11 for
pre-10-K IPOs; 20-F attempted). A card is the read-once-query-many cache:
business description, sellsTo, named customers and suppliers, exposures
with STANCE (core_product, active_investment, risk_mention) each backed by
an exact sentence, catalysts, TAM claims, all under a controlled tag
vocabulary (free-form tags fragment into synonyms). Why the corpus exists:
any scenario or news article must connect to the whole universe, and
re-reading 10-Ks per query is unaffordable; carding cost about $13 total at
light-tier prices. Windows lesson: a ticker named CON produced a reserved
filename that silently aborted git staging; cardFilename() sanitizes.
Section extraction lessons encoded in src/hermes/sections.ts: item headings
with optional punctuation, table-of-contents detection by span length
(a start/end pair closer than 2,500 chars is a TOC row), end-marker search
from start+8, prospectus headings with dot-leader rejection, and
entity-stripped apostrophes ("Management s Discussion").

## 5. The app and the design system

React + Vite (web/), built to /app/. Design system in design.md and it is
binding: true-black monochrome, white the only accent, Newsreader display,
IBM Plex Sans body, IBM Plex Mono for anything that is a fact or symbol;
polarity green/red are DATA colors exempt from monochrome; radius scale
999/12/6; no gradients, no glow. Voice rules are hard gates: no em-dashes,
no exclamation points, no superlatives, M thousands MM millions in
financial docs, plain dollars customer-facing; a lint pass greps every
shipped artifact. Wordmarks and all lockup text are set in real type,
never AI-rendered (an AI end card once shipped "Corraorian").

UI behaviors that encode product philosophy: provenance tags on every data
block; stub notes where a seam has no key; the cap-provenance footnote
everywhere caps render; honesty captions on the transcript stand-in and
job-board data; counter runs nested behind their base run, not sibling
chips; run chips dedupe by seed; search ranks exact ticker, ticker prefix,
name prefix, word-boundary, then substring (the "olin" returning Bank of
South CarOLINa bug); live-progress rendering (map at ~2 min, candidates
~4 min, stages applied with a signature guard against poll churn, honest
"still reading" note). A run takes 45-50 minutes end to end; the cost is
sequential rate-limited SEC I/O (a global 150ms throttle under the 10/s
fair-access rule, with the same submissions JSON currently fetched by seven
modules per candidate) plus about 40 sequential model calls; agreed
optimization path is memoize-then-parallelize toward 8-12 minutes.

## 6. Access, quotas, and deployment posture

HMAC-SHA256 signed session tokens (7-day TTL, timing-safe compare), email
allowlist, shared SITE_PASSCODE on top (research-preview posture), Google
sign-in seam (GIS ID-token verified server-side via tokeninfo, renders only
when GOOGLE_CLIENT_ID is set). Per-email per-UTC-day quota (RUNS_PER_DAY,
12) on the five spend routes: fresh run, article run, drill, counter,
on-demand card. Why quotas are the only spend brake: the allowlist is
small and real; billing does not exist yet (Stripe-ready tables sit unused
in Supabase). Single-tenant preview honestly stated: all users see all
runs.

## 7. Run reuse and its guardrail

findExistingRun reuses a completed run when a new query matches by slug or
by strong topical overlap: 3+ meaningful shared words AND half the shorter
side, stopwords and bare years excluded. It was originally 2 shared words,
which served a battery-storage run for a freight-rail query because both
contained "through 2028." Reuse must never beat correctness in front of a
user; when in doubt, run fresh.

## 8. Economics and go-to-market context (pointers)

A full run costs roughly $0.10-0.15 at DeepSeek prices; carding the corpus
cost ~$13; hosting ~$0 (own PC) to ~$10/month (Railway). Pricing strategy
(gtm.md): land at $150/month per analyst self-serve, $1,500/month desk
tier; never open with enterprise pricing that needs procurement. The
outreach engine is the map-as-gift loop: run a fund's stated thesis
through the engine and send the three-node excerpt as the email itself
(zero time-to-first-value). The immediate live context is a 30-minute
walkthrough with T. Rowe Price (trowe-demo.md): frame as work sample, not
sales call; three names presented obvious/overlooked/demoted; close with
"not automating conviction, expanding the search surface."

## 9. Known weaknesses, stated plainly (do not paper over these)

1. Orders are hop-based; the Reactions layer (who is hurt, what do they
   do) does not exist. Largest reasoning gap.
2. No Expectations layer: nothing compares a thesis to consensus,
   revisions, valuation, or price reaction. Largest edge gap; free first
   version is feasible (short interest, 13F crowding, price reaction).
3. Keyword adjacency still admits names the exposure grade must then
   demote; capture verification lacks segment-revenue weighting.
4. Sell-side coverage is a stub without a key, labeled as such.
5. Run latency 45-50 minutes (see 5; optimization path agreed).
6. Single-tenant, in-memory jobs, PC-hosted; all stated in DEPLOY.md.
7. Scores render as 0-100 composites; should be bands with explanations.
8. Ticker drift requires scheduled cache refresh; currently manual.

## 10. The redesign contract

Any rewrite keeps these invariants or it is a different product:
- Every claim resolves to a primary-source sentence with a link.
- Every number carries provenance; absence renders as honest absence.
- Both polarities always; the disconfirming case is generated, not
  optional.
- Deterministic wherever determinism suffices (item codes, arithmetic,
  ranking); models only where judgment is required, choosing from menus
  rather than inventing identifiers.
- Artifacts on disk between stages; prompts saved before every call.
- Rank and flag, never assert; flagged names never lead.
- The audit object is the cited graph and saved prompts, not
  chain-of-thought prose.
