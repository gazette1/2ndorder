# Adoption Chain

Idea-generation engine for a small-cap growth team. Seed thesis in, ranked under-covered small-cap candidates out, each with a one-page thesis draft citing the exact SEC filing sentences behind every claim. Design rationale: docs/DESIGN.md.

## Run the pipeline

```
npm install
npm run stage -- decompose <slug> "<seed thesis>"
npm run stage -- map <slug>       # EDGAR full-text search + float filter
npm run stage -- enrich <slug>    # dossier: Form 4 insider, XBRL, USASpending, reverse-citation, sell-side coverage
npm run stage -- read <slug>      # pull filings, excerpt, score the four judged dimensions
npm run stage -- score <slug>     # merge two deterministic dimensions, weighted composite
npm run stage -- draft <slug>     # one-page thesis per name, bear case first
npm run stage -- publish <slug>   # write web/public/data/latest.json
```

Or all stages: `npm run dry-run -- <slug> "<seed thesis>"`.

## Reasoning model

Model calls route through one adapter (src/lib/llm.ts), selected by `LLM_PROVIDER`:

- `fixture` (default): reads authored fixtures from fixtures/<slug>/, fails loudly when one is missing. The pipeline runs with no setup.
- `ollama`: a local open model, free. Pull one first, for example `ollama pull gemma2:27b`, then set `LLM_PROVIDER=ollama` (and `LLM_MODEL` if not the default).
- `openai`: any OpenAI-compatible endpoint (DeepSeek, Groq, Together). Set `LLM_PROVIDER=openai`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `LLM_MODEL`.

Every prompt is saved to data/runs/<slug>/prompts/ regardless of provider.

The `enrich` stage runs live with no key: SEC Form 4, SEC XBRL, USASpending, and reverse-citation are all free and complete. Set FINNHUB_API_KEY to make sell-side coverage (analyst count, consensus, price target, firm rating actions) live; without it an authored fixture stands in, tagged as not live. The bank reports themselves are paywalled and are never served, only the firm, grade, target, and date, with a link to where the action was reported.

## Web app

```
npm run serve            # API server on http://localhost:8787 (login, search, runs)
cd web && npm run dev    # front end on http://localhost:5173, proxies /api to the server
```

Sign in (mock session, any email), then search a thesis, theme, or company. A cached run returns instantly; a novel query runs the pipeline when a model is wired, or reports needs_model in fixture mode. The dossier shows fundamentals, the Form 4 insider table, the customer graph, and the sell-side coverage block, with direct links to the underlying SEC filings. The front end falls back to the static published payload if the API is not running.

## Store

Supabase schema in supabase/migrations/0001_init.sql. The scaffold persists the same shapes to data/runs/<slug>/ as JSON because the account's Supabase projects are paused; the swap is a write-path change only.

## Sample run

data/runs/humanoid-robotics/ holds a complete dry run on "Humanoid robotics reaches commercial deployment 2027-2030": 80 companies mapped, 34 in the $150MM to $5,000MM float band, three read and drafted (USAR 80, MATW 16, KELYB 9).
