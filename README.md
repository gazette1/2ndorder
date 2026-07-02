# Adoption Chain

Idea-generation engine for a small-cap growth team. Seed thesis in, ranked under-covered small-cap candidates out, each with a one-page thesis draft citing the exact SEC filing sentences behind every claim. Design rationale: docs/DESIGN.md.

## Run the pipeline

```
npm install
npm run stage -- decompose <slug> "<seed thesis>"
npm run stage -- map <slug>       # EDGAR full-text search + float filter
npm run stage -- read <slug>      # pull filings, excerpt, score against rubric
npm run stage -- score <slug>     # deterministic weighted composite
npm run stage -- draft <slug>     # one-page thesis per name, bear case first
npm run stage -- publish <slug>   # write web/public/data/latest.json
```

Or all stages: `npm run dry-run -- <slug> "<seed thesis>"`.

Model calls use claude-fable-5 when ANTHROPIC_API_KEY is set. Without a key the pipeline reads authored fixtures from fixtures/<slug>/ and fails loudly when one is missing; every prompt is saved to data/runs/<slug>/prompts/ either way.

## Front end

```
cd web
npm install
npm run dev
```

Single page: the adoption chain, the ranked candidate table, thesis drafts with clickable citations, and a rubric panel whose weight sliders re-rank candidates client-side.

## Store

Supabase schema in supabase/migrations/0001_init.sql. The scaffold persists the same shapes to data/runs/<slug>/ as JSON because the account's Supabase projects are paused; the swap is a write-path change only.

## Sample run

data/runs/humanoid-robotics/ holds a complete dry run on "Humanoid robotics reaches commercial deployment 2027-2030": 80 companies mapped, 34 in the $150MM to $5,000MM float band, three read and drafted (USAR 80, MATW 16, KELYB 9).
