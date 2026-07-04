# Deploying Corollary to corollaryresearch.com

One node process serves everything: the landing page at /, the app at /app,
and the API at /api. The research corpus ships inside the image; scenario runs
persist on a mounted volume.

## Before anything else (blockers)

1. Rotate the DeepSeek API key at platform.deepseek.com and use the NEW key in
   the host environment. The old key was exposed during development.
2. Generate a SESSION_SECRET:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Decide the pilot allowlist (ALLOWED_EMAILS). Empty means anyone with the
   URL can sign in and spend model budget up to the per-day quota.

## Host (Railway, Render, or Fly.io; ~$5-10/month)

All three build the Dockerfile at the repo root directly from GitHub
(gazette1/2ndorder).

Railway (simplest):
1. railway.app -> New Project -> Deploy from GitHub repo -> pick 2ndorder.
2. It detects the Dockerfile. Add a volume mounted at /srv/data/runs (1GB is
   plenty to start).
3. Set the environment variables from .env.example (rotated key, secret,
   allowlist). Set PORT to 8787 or let Railway inject its own (the server
   reads PORT).
4. Deploy, then open the generated URL: / should show the landing, /app the
   sign-in, /healthz {"ok":true}.

## Domain

In the host's settings add the custom domain corollaryresearch.com (and www).
At the registrar, point DNS as instructed (CNAME for www, A/ALIAS for apex).
TLS certificates are automatic on all three hosts.

## Smoke test after deploy

- GET /            -> landing page with the brain video
- GET /healthz     -> {"ok":true}
- /app             -> sign in with an allowlisted email; a non-listed email
                      must see "This email is not on the preview list."
- Run one scenario end to end, open the memo, look up one stock.
- Confirm the quota message appears after RUNS_PER_DAY runs on a test email.

## Costs and limits, stated plainly

- Model spend flows through the DeepSeek key. A scenario run costs cents; the
  daily per-user quota is the only spend brake, so keep the allowlist real.
- Market caps come from delayed Yahoo quotes (unofficial) and SEC shares
  outstanding; sell-side coverage is stubbed unless FINNHUB_API_KEY is set.
  Both are labeled in the product.
- The jobs table is in-memory: a redeploy mid-run loses the job status, but
  completed stages persist on the volume and rerunning the same scenario
  resumes from disk.
- This is a research preview for design partners, not a hardened multi-tenant
  SaaS: no per-user data isolation (all users see all runs), no billing, no
  SSO. Say so in the pilot agreement.
