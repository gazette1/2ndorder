# Implementation decisions against the master prompt

Running log of deliberate adaptations, per section 2.4 of the prompt.

1. **Runtime validation without new dependencies.** The prompt suggests Zod
   or JSON Schema. The repo has zero runtime dependencies beyond tsx, the
   owner's standing rule is ask-before-adding-dependencies, and the demo is
   days away. Decision: hand-rolled deterministic validator functions in
   src/schema/, same pattern as the existing trigger validator. Swappable
   for Zod later without schema changes.
2. **TriggerContract v1 kept, extended toward section 9.3 rather than
   replaced.** The v1 contract shipped earlier today and passes the AP
   acceptance test. Section 9.3's richer fields (typed PolicyStatus set,
   targetProducts as ProductLine records, openQuestions as SourceGap) are
   layered on as schemaVersion 2 fields; v1 artifacts remain readable.
3. **Tests as tsx scripts.** No test framework exists; the repo's convention
   is executable scripts (verify.ts, day1-acceptance.ts). Regression tests
   live in scripts/tests/ and run through npm run test, exiting non-zero on
   failure. Adding vitest is deferred (dependency rule).
4. **Existing stage names kept.** The prompt's target sequence maps onto the
   current pipeline; new stages (validate-trigger, validate-candidates,
   materiality, expectations, judge) are inserted under their prompt names
   without renaming existing stages, preserving old-run compatibility.
5. **The in-flight AP counter run (started before this execution) is left
   untouched**; it predates the product-scope gate and will be superseded by
   a fresh gated run.
