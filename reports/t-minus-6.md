# T-minus-6 status

Calendar note: demo is Saturday; this report covers the T-6 work block
(baseline, contracts, and the fatal gate), executed the evening of Monday
August 25.

## Outcome today

- Baseline recorded (reports/baseline.md): typechecks, build, and the
  existing verify harness all pass; the failed AP run is preserved untouched
  as the regression fixture.
- Schema v2 foundation shipped (src/schema/v2.ts): typed event
  classification with a deterministic fallback, INV-004 product-scope gate,
  token-set unsupported-number scanner (value plus unit matching, substring
  matches forbidden), evidence store (evidence-index.json per run, the
  source article recorded as ev-001), and the deterministic
  missing-information detector emitting SourceGap records (gaps.json).
- Runtime enforcement: runFromArticle extracts and validates the evidence-
  bound trigger contract, records evidence, persists gaps, then runs the
  product-scope gate; a blocked run saves a research-status card and stops
  before decomposition. No tickers from unresolved scope.
- Earlier the same day (pre-prompt, counted toward T-6): story-body article
  extraction fix (the root cause of the invented numbers), trigger contract
  v1 with per-field quotes, Day 1 acceptance test 8/8 against the live AP
  article.

## Tests

npm run test: 12 checks, 0 failures.
- Old AP trigger's invented 10-to-25 range is caught by the scanner.
- New AP contract's magnitudes are all source-supported.
- Product-scope gate matrix: blocked, resolved, partial-with-warning,
  non-product, unknown-status.
- Gap detector: trade-code and exclusions gaps on the real AP contract, no
  false blocking gap, blocking gap on the empty-scope fixture.
npm run verify: 0 failures, 1 warning (in-flight legacy counter run).

## Judge result

Not yet built (T-2 scope).

## Regressions

None observed. Old runs render (payload compatibility checks in verify).

## Open blockers

None for T-5. Live research providers (T-5) have no credentialed search
API; plan is fixture provider first, live adapter behind an env seam.

## Demo risk

Moderate and falling. The fatal-gate class of failure (invented numbers,
scope-less tariff mapping) is now structurally blocked and regression-
tested. Largest remaining risks: candidate relationship precision (T-4)
and the judge/no-pick presentation (T-2/T-3).

## First task tomorrow (T-5)

Research provider interface with the offline fixture provider; resolve the
AP run's product list and trade codes from authoritative fixtures (White
House annex, Canada Department of Finance list); retaliation as a separate
RetaliationScenario; the researched-trigger diff artifact.
