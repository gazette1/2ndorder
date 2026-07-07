# Deploying Corollary to corollaryresearch.com

One node process serves everything: the landing page at /, the app at /app,
and the API at /api. The research corpus and a set of demo runs ship inside
the image; new scenario runs persist on a mounted volume.

## The one thing to know first

The site can go live with the landing page and a browsable app WITHOUT the
DeepSeek key. The corpus, the demo runs, sign-in, and stock lookups all work
with no model key. Only generating a NEW scenario run needs the DeepSeek key.
So the key rotation does not block getting corollaryresearch.com up; it blocks
live runs. Deploy today, add the key when it is rotated.

## Go-live checklist (Railway + Cloudflare)

You have the GitHub repo (gazette1/2ndorder, branch master) and the Cloudflare
domain. Steps in order:

1. Generate a session secret (run locally, copy the output):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. railway.app -> log in with GitHub -> New Project -> Deploy from GitHub repo
   -> pick 2ndorder. It detects the Dockerfile and builds automatically.
3. In the service, add a Volume mounted at `/srv/data/runs` (1 GB).
4. Set environment variables (Variables tab). Required for the site to be up:
   - `SESSION_SECRET` = the string from step 1
   - `ALLOWED_EMAILS` = your email plus any demo emails, comma-separated.
     Leave empty only if you want anyone with the URL to be able to sign in.
   Add these when the DeepSeek key is rotated, to enable live runs:
   - `LLM_PROVIDER` = openai
   - `OPENAI_BASE_URL` = https://api.deepseek.com/v1
   - `OPENAI_API_KEY` = the NEW rotated DeepSeek key
   Optional, enable richer enrichment in live runs:
   - `DATA_GOV_API_KEY`, `CENSUS_API_KEY`, `GOOGLE_CLIENT_ID` (see below)
   Do not set PORT; Railway injects one and the server reads it.
5. Deploy. Open the generated `*.up.railway.app` URL and confirm:
   `/` shows the landing, `/app` shows sign-in, `/healthz` returns
   `{"ok":true}`, and after signing in the app lists the demo runs.
6. Railway -> Settings -> Networking -> Custom Domain -> add
   `corollaryresearch.com` and `www.corollaryresearch.com`. Railway shows a
   target hostname (like `xxxx.up.railway.app`) for each.
7. In Cloudflare DNS for corollaryresearch.com:
   - CNAME `www` -> the Railway target, Proxy status ON (orange cloud).
   - CNAME `@` (apex) -> the Railway target. Cloudflare flattens apex CNAMEs
     automatically. Proxy ON.
8. Cloudflare -> SSL/TLS -> Overview -> set encryption mode to
   **Full (strict)**. The default Flexible mode causes redirect loops against
   these hosts. This is the single most common Cloudflare mistake.
9. Wait for the certificate (a few minutes), then open
   https://corollaryresearch.com and re-run the smoke test from step 5.

## Google sign-in (optional, adds the "Continue with Google" button)

1. console.cloud.google.com -> Create an OAuth 2.0 Client ID (Web
   application).
2. Authorized JavaScript origins: add `https://corollaryresearch.com` and the
   Railway URL.
3. Copy the Client ID, set it as `GOOGLE_CLIENT_ID` in Railway. No client
   secret is needed (the app uses the ID-token flow). The button appears
   automatically when the variable is set; email sign-in works either way.

## Smoke test after deploy

- GET /            -> landing page with the brain video
- GET /healthz     -> {"ok":true}
- /app             -> sign in with an allowlisted email; a non-listed email
                      must see "This email is not on the preview list."
- The app lists the seeded demo runs; open one, read the memo, look up a stock.
- With the DeepSeek key set: run one new scenario end to end, and confirm the
  quota message appears after RUNS_PER_DAY runs on a test email.

## Costs and limits, stated plainly

- Hosting is about $5 to $10 a month on Railway.
- Model spend flows through the DeepSeek key. A scenario run costs cents; the
  daily per-user quota is the only spend brake, so keep the allowlist real.
- Market caps come from delayed Yahoo quotes (unofficial) and SEC shares
  outstanding; sell-side coverage is stubbed unless FINNHUB_API_KEY is set.
  Both are labeled in the product.
- The jobs table is in-memory: a redeploy mid-run loses the job status, but
  completed stages persist on the volume and rerunning the same scenario
  resumes from disk.
- Demo runs are seeded into the volume on first boot only; after that the
  volume is the source of truth and redeploys do not overwrite it.
- This is a research preview for design partners, not a hardened multi-tenant
  SaaS: no per-user data isolation (all users see all runs), no billing, no
  SSO. Say so in the pilot agreement.
