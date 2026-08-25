# Baseline, start of master-prompt execution (2026-08-25 evening)

Commit at baseline: 9abce3f (branch go-live-2026-08-01).

## Toolchain state

- Engine typecheck: PASS (tsc --noEmit, zero errors).
- Web typecheck: PASS.
- Web build: PASS (vite, ~700ms).
- npm run verify (existing integrity harness): 0 failures, 1 warning (a
  counter run for the AP article is mid-flight and unscored; expected).
- No test framework beyond scripts/verify.ts and scripts/day1-acceptance.ts;
  no AGENTS.md in the repository. Tests below are added as tsx scripts wired
  into npm scripts, matching the repo's existing convention.

## Pipeline state relevant to the master prompt

Already present (built earlier today, ahead of this prompt):

- Evidence-bound TriggerContract v1 (src/pipeline/trigger.ts): per-field
  exactQuote and confidence, deterministic validator (numbers must appear in
  article text, quote containment, inferred magnitudes are a hard stop),
  pipeline halt on failure, article.txt persisted, decompose copies contract
  facts. Day 1 acceptance test passes 8/8 against the live AP article on
  deepseek-v4-pro.
- Article extraction reads the story body (densest paragraph cluster plus
  known containers), fixing the root cause where AP page chrome reached the
  model and numbers were invented.
- Model-call provenance per run (outputs/ plus model-calls.jsonl with model,
  tier, endpoint, tokens, cost, latency).
- K/M/B money convention everywhere; verify harness enforces it.
- TRACE-lite decompose (trigger, stakeholder reactions, per-node kpi and
  falsifier), fund-scale reality check, expectations proxies, score bands.

## Preserved regression references (not edited)

- data/runs/news-apnews-com-article-trump-tariffs-canada-us-trade-war-29:
  the failed AP run this build must fix. Its decompose.json contains the
  invented "10 to 25 percentage points" assumption; kept verbatim as the
  regression fixture.
- data/runs/day1-acceptance: the passing trigger-contract extraction of the
  same article under the new pipeline.

## Known gaps against the master prompt at baseline

- No product-scope gate (INV-004): tariff mapping can start with empty
  targeted products.
- No candidate state machine or role classifier (sections 17-18).
- No materiality or expectations assessment records (sections 19-20).
- No scenario-specific score template (section 21).
- No LLM judge or repair loop (sections 24-25).
- No schema v2 artifact envelopes (section 8).

## Implementation decisions

See reports/implementation-decisions.md.
