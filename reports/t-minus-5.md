# T-minus-5 status

Executed immediately after T-6 (same evening, Monday August 25). Demo is
Saturday.

## Outcome today

- Research provider interface (src/research/provider.ts): fixture provider
  for deterministic tests, direct provider that fetches explicitly supplied
  authoritative URLs through the article extractor, and a disabled provider
  that returns a structured unavailable state. No credentialed search API
  exists this week, so query-driven live search remains a labeled seam; a
  document's mode (live, fixture, unavailable) is recorded on every doc and
  fixture evidence carries kind test_fixture with the lowest authority rank.
- Research pass (src/pipeline/research.ts): plans bounded queries from the
  open gaps (targeted forms, capped at 8), executes via the provider,
  records evidence, merges findings into trigger-researched.json guarded by
  the unsupported-number scanner across the article plus all researched
  documents, and writes trigger-source-only.json plus an inspectable
  field-level trigger-diff.json.
- Retaliation engine: every counter-action extracted into three strictly
  separated groups (official, threatened, modeled); official and threatened
  actions require verbatim article quotes, modeled actions default to
  not_scored. Live result on the AP article: Carney dollar-for-dollar
  (official, Sept. 8), Ford electricity and critical minerals plus the
  threatened auto/parts/steel escalation to 50% on Jan. 1, 2027
  (threatened), one modeled action.
- Sector transmission (mapSectors): 12 sectors from the researched contract
  plus retaliation, both polarities enforced (8 at risk), channels typed
  (including retaliation_exposure), one challengeable mechanism sentence
  each.
- All wired into runFromArticle after the product-scope gate.

## Tests

- npm run test (deterministic regression): 12 checks, 0 failures.
- scripts/tests/t5-live.ts (live model checkpoint): 17 checks, 0 failures,
  covering disabled-mode honesty, fixture-mode merge with diff, retaliation
  grouping with quote-backing, and sector mapping with both polarities.
- Total model spend for the T-5 live suite: about $0.015.

## Judge result

Not yet built (T-2 scope).

## Regressions

None. npm run verify remains green.

## Open blockers

None for T-4.

## Demo risk

Falling. The trigger and research half of the pipeline now fails closed at
every step. The remaining top risk is candidate relationship precision
(T-4: role classifier, rejection rules, state machine), which is where the
Tejon-Ranch-as-customs-adviser class of error lives.

## First task tomorrow (T-4)

Company-role classifier over filing excerpt plus Hermes card context;
deterministic rejection rules; candidate states with raw matches never
rendered as candidates; semantic regression fixtures for the known wrong
mappings from the failed AP run.
