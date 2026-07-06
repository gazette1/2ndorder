import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';
import { checkAlerts } from '../src/pipeline/alerts.js';
import { drill } from '../src/pipeline/decompose.js';
import { mapTickers } from '../src/pipeline/map.js';
import { buildMemo } from '../src/pipeline/memo.js';
import { runAll, runCounter, runFromArticle } from '../src/pipeline/orchestrate.js';
import { overlay } from '../src/pipeline/overlay.js';
import { buildPayload } from '../src/pipeline/payload.js';
import { cardFilename } from '../src/hermes/card.js';
import { cardCompany } from '../src/hermes/carder.js';
import { loadUniverse } from '../src/hermes/universe.js';
import { tickerMap } from '../src/lib/edgar.js';
import { save } from '../src/lib/store.js';

// Thin API for the web app. No framework, node:http only.
//   POST /api/login   { email }            -> { token, email }   (mock session; swap for Supabase Auth)
//   GET  /api/runs                         -> { runs: [...] }
//   GET  /api/runs/:id                     -> { status, payload }
//   POST /api/search  { query }            -> { runId, status }   (serves a cached run, or runs live)
// Auth is a mock bearer token so the shape is real; production swaps in Supabase Auth.

const PORT = Number(process.env.PORT ?? 8787);
const RUNS_DIR = path.resolve('data/runs');

// In-memory job status for live runs. A real deployment uses a queue and a table.
const jobs = new Map<string, { status: 'running' | 'ready' | 'error'; error?: string }>();

function slugify(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'run';
}

function hasRun(slug: string): boolean {
  return fs.existsSync(path.join(RUNS_DIR, slug, 'theses.json'));
}

function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs
    .readdirSync(RUNS_DIR)
    .filter((d) => hasRun(d))
    .map((id) => {
      const run = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, id, 'run.json'), 'utf8'));
      return { id, seed: run.seed, createdAt: run.createdAt, mode: CONFIG.llm.provider === 'fixture' ? 'fixture' : 'live' };
    });
}

// Match a free-text query to an existing run by slug or by seed overlap, so
// "humanoid robots" resurfaces the humanoid-robotics run instead of rerunning.
function findExistingRun(query: string): string | null {
  const slug = slugify(query);
  if (hasRun(slug)) return slug;
  const words = new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  for (const r of listRuns()) {
    const seedWords = new Set(String(r.seed).toLowerCase().split(/\W+/));
    const overlap = [...words].filter((w) => seedWords.has(w)).length;
    if (overlap >= 2) return r.id;
  }
  return null;
}

function send(res: http.ServerResponse, code: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(json);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// ---- sessions: HMAC-signed tokens, optional email allowlist, daily quotas ----
// SESSION_SECRET signs tokens (a random one is generated per boot when unset,
// which invalidates sessions on restart; set it in production).
// ALLOWED_EMAILS is a comma-separated allowlist; empty means open pilot mode.
// RUNS_PER_DAY caps expensive operations (scenario/article runs, drills,
// counters, on-demand cards) per email per UTC day.
import crypto from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[api] SESSION_SECRET not set: sessions will not survive a restart. Set it in production.');
}
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const RUNS_PER_DAY = Number(process.env.RUNS_PER_DAY ?? 12);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function signToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { e: string; x: number };
    if (Date.now() > data.x) return null;
    return data.e;
  } catch {
    return null;
  }
}

function sessionEmail(req: http.IncomingMessage): string | null {
  const h = req.headers.authorization ?? '';
  if (!h.startsWith('Bearer ')) return null;
  return verifyToken(h.slice(7));
}

// Per-email, per-UTC-day counter for spend-incurring operations.
const usage = new Map<string, { day: string; used: number }>();
function takeQuota(email: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(email);
  if (!u || u.day !== day) {
    usage.set(email, { day, used: 1 });
    return true;
  }
  if (u.used >= RUNS_PER_DAY) return false;
  u.used++;
  return true;
}
const QUOTA_MSG = `Daily limit reached (${RUNS_PER_DAY} model runs per day during the research preview).`;

// ---- static serving: one deployable process ----
// When web/dist exists (a production build), this server also serves the
// marketing landing at /, the app at /app, media, and the demo data payload.
// In development vite serves the app instead and only /api hits this server.
const WEB_PUBLIC = path.resolve('web/public');
const WEB_DIST = path.resolve('web/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveFile(res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(fs.readFileSync(filePath));
  return true;
}

// Resolve a URL path against a root, refusing traversal outside it.
function safeJoin(root: string, urlPath: string): string | null {
  const resolved = path.resolve(root, '.' + urlPath);
  return resolved.startsWith(root) ? resolved : null;
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  if (req.method !== 'GET') return false;
  if (pathname === '/healthz') {
    send(res, 200, { ok: true });
    return true;
  }
  if (pathname === '/' || pathname === '/landing.html') {
    return serveFile(res, path.join(WEB_PUBLIC, 'landing.html'));
  }
  if (pathname.startsWith('/media/') || pathname.startsWith('/data/')) {
    const p = safeJoin(WEB_PUBLIC, pathname);
    return p ? serveFile(res, p) : false;
  }
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    if (!fs.existsSync(WEB_DIST)) return false; // dev: vite owns the app
    const rel = pathname.slice('/app'.length) || '/index.html';
    const p = safeJoin(WEB_DIST, rel);
    if (p && serveFile(res, p)) return true;
    return serveFile(res, path.join(WEB_DIST, 'index.html')); // SPA fallback
  }
  return false;
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => send(res, 500, { error: String((e as Error).message ?? e) }));
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (!pathname.startsWith('/api/') && serveStatic(req, res, pathname)) return;

  // Login: HMAC-signed 7-day session. With ALLOWED_EMAILS set, only listed
  // addresses get in; unset means open pilot mode. There is no password in the
  // research preview; access control is the allowlist itself.
  if (req.method === 'POST' && pathname === '/api/login') {
    const { email } = await readBody(req);
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      return send(res, 400, { error: 'a valid email is required' });
    }
    if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(normalized)) {
      return send(res, 403, { error: 'This email is not on the preview list. Ask for access.' });
    }
    return send(res, 200, { token: signToken(normalized), email: normalized });
  }

  // Which auth methods are live. The login screen shows the Google button only
  // when a client id is configured on the server.
  if (req.method === 'GET' && pathname === '/api/auth-config') {
    return send(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID ?? null });
  }

  // Sign in with Google: the browser's Google Identity Services button posts
  // an ID token here; Google's tokeninfo endpoint validates the signature so
  // no JWT library is needed. Same allowlist and session as email login.
  if (req.method === 'POST' && pathname === '/api/login/google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return send(res, 501, { error: 'Google sign-in is not configured on this server.' });
    const { credential } = await readBody(req);
    if (!credential || typeof credential !== 'string') {
      return send(res, 400, { error: 'missing Google credential' });
    }
    try {
      const gres = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!gres.ok) return send(res, 401, { error: 'Google rejected the sign-in token.' });
      const info = (await gres.json()) as { aud?: string; email?: string; email_verified?: string; exp?: string };
      if (info.aud !== clientId) return send(res, 401, { error: 'Google token was issued for a different app.' });
      if (info.email_verified !== 'true' || !info.email) {
        return send(res, 401, { error: 'Google account email is not verified.' });
      }
      const normalized = info.email.trim().toLowerCase();
      if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(normalized)) {
        return send(res, 403, { error: 'This email is not on the preview list. Ask for access.' });
      }
      return send(res, 200, { token: signToken(normalized), email: normalized });
    } catch {
      return send(res, 502, { error: 'Could not verify the Google sign-in. Try again.' });
    }
  }

  // Everything below requires a valid session.
  const userEmail = sessionEmail(req);
  if (!userEmail) return send(res, 401, { error: 'sign in first' });

  if (req.method === 'GET' && pathname === '/api/runs') {
    return send(res, 200, { runs: listRuns() });
  }

  // Company lookup over the Hermes corpus: search the index, fetch one card.
  if (req.method === 'GET' && pathname === '/api/companies') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    if (!q) return send(res, 400, { error: 'q required' });
    const indexPath = path.resolve('data/corpus/index.json');
    if (!fs.existsSync(indexPath)) return send(res, 200, { results: [], corpusSize: 0 });
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, { name: string; tags: string[]; filedAt: string }>;
    const results = Object.entries(index)
      .filter(([t, v]) => t.toLowerCase().startsWith(q) || v.name.toLowerCase().includes(q))
      .sort(([a], [b]) => {
        // exact ticker first, then ticker prefix, then name matches
        const qa = a.toLowerCase() === q ? 0 : a.toLowerCase().startsWith(q) ? 1 : 2;
        const qb = b.toLowerCase() === q ? 0 : b.toLowerCase().startsWith(q) ? 1 : 2;
        return qa - qb || a.localeCompare(b);
      })
      .slice(0, 20)
      .map(([ticker, v]) => ({ ticker, name: v.name, tags: v.tags, filedAt: v.filedAt }));
    return send(res, 200, { results, corpusSize: Object.keys(index).length });
  }

  if (pathname.startsWith('/api/companies/')) {
    const parts = pathname.slice('/api/companies/'.length).split('/');
    const ticker = decodeURIComponent(parts[0]).toUpperCase();
    const cardPath = path.resolve('data/corpus/cards', cardFilename(ticker));

    // On-demand carding: read the 10-K live for a ticker the corpus missed.
    if (req.method === 'POST' && parts[1] === 'card') {
      if (CONFIG.llm.provider === 'fixture') {
        return send(res, 200, { status: 'needs_model', message: 'Carding needs a model provider (LLM_PROVIDER).' });
      }
      if (!takeQuota(userEmail)) return send(res, 429, { error: QUOTA_MSG });
      const tickers = await tickerMap();
      let cik: string | null = null;
      let name = ticker;
      for (const [c, v] of tickers) {
        if (v.ticker.toUpperCase() === ticker) { cik = c; name = v.title; break; }
      }
      if (!cik) return send(res, 404, { error: 'not a US-listed SEC filer under this ticker' });
      const card = await cardCompany(cik, ticker, name);
      if (!card) return send(res, 422, { error: 'could not build a card: no 10-K on file, or its sections could not be extracted' });
      const uniC = loadUniverse();
      const entryC = uniC ? uniC.find((e) => e.ticker.toUpperCase() === ticker) : null;
      return send(res, 200, { card, marketCapMM: entryC ? entryC.marketCapMM : null, capSource: entryC ? 'price_x_shares' : null });
    }

    if (req.method === 'GET' && !parts[1]) {
      if (!fs.existsSync(cardPath)) return send(res, 404, { error: 'no card for this ticker in the corpus' });
      const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
      const uni = loadUniverse();
      const entry = uni ? uni.find((e) => e.ticker.toUpperCase() === ticker) : null;
      return send(res, 200, {
        card,
        marketCapMM: entry ? entry.marketCapMM : null,
        capSource: entry ? 'price_x_shares' : null,
      });
    }
  }

  // /api/runs/:id and /api/runs/:id/<action>
  if (pathname.startsWith('/api/runs/')) {
    const [id, action] = pathname.slice('/api/runs/'.length).split('/');

    if (req.method === 'GET' && !action) {
      const job = jobs.get(id);
      // Serve the payload the moment the base run is complete on disk, even if
      // the job is still working (an article run keeps going to compute the
      // counter-scenario; the bull side should not wait for the bear side).
      if (job && job.status !== 'ready' && !hasRun(id)) {
        return send(res, 200, { status: job.status, error: job.error });
      }
      if (!hasRun(id)) return send(res, 404, { error: 'no such run' });
      return send(res, 200, { status: 'ready', payload: buildPayload(id) });
    }

    if (!hasRun(id)) return send(res, 404, { error: 'no such run' });

    // The IC memo, rebuilt fresh on every request so it reflects the run's current state.
    if (req.method === 'GET' && action === 'memo') {
      const html = buildMemo(id);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      return res.end(html);
    }

    // Cached alerts, or a live EDGAR re-check with ?refresh=1.
    if (req.method === 'GET' && action === 'alerts') {
      if (url.searchParams.get('refresh') === '1') {
        return send(res, 200, await checkAlerts(id));
      }
      const p = path.join(RUNS_DIR, id, 'alerts.json');
      if (!fs.existsSync(p)) return send(res, 404, { error: 'no alerts generated yet, call with refresh=1' });
      return send(res, 200, JSON.parse(fs.readFileSync(p, 'utf8')));
    }

    // Drill one node a level deeper, then map the new children. Synchronous.
    if (req.method === 'POST' && action === 'drill') {
      const { nodeId } = await readBody(req);
      if (!nodeId) return send(res, 400, { error: 'nodeId required' });
      if (CONFIG.llm.provider === 'fixture') {
        return send(res, 200, { status: 'needs_model', message: 'Drill needs a model provider (LLM_PROVIDER).' });
      }
      if (!takeQuota(userEmail)) return send(res, 429, { error: QUOTA_MSG });
      const children = await drill(id, nodeId);
      await mapTickers(id, children.map((n) => n.id));
      return send(res, 200, { status: 'ready', added: children.length });
    }

    // Counter-scenario: generate the disconfirming case and run it fully, async.
    if (req.method === 'POST' && action === 'counter') {
      if (CONFIG.llm.provider === 'fixture') {
        return send(res, 200, { status: 'needs_model', message: 'Counter-scenario needs a model provider (LLM_PROVIDER).' });
      }
      const counterId = `${id}-counter`;
      if (hasRun(counterId)) return send(res, 200, { runId: counterId, status: 'ready' });
      if (!takeQuota(userEmail)) return send(res, 429, { error: QUOTA_MSG });
      jobs.set(counterId, { status: 'running' });
      runCounter(id)
        .then(() => jobs.set(counterId, { status: 'ready' }))
        .catch((e) => jobs.set(counterId, { status: 'error', error: String(e?.message ?? e) }));
      return send(res, 202, { runId: counterId, status: 'running' });
    }

    // 13F overlay: place a fund's holdings on the map. Synchronous.
    if (req.method === 'POST' && action === 'overlay') {
      const { fund } = await readBody(req);
      if (!fund) return send(res, 400, { error: 'fund required' });
      try {
        return send(res, 200, await overlay(id, String(fund)));
      } catch (e) {
        return send(res, 422, { error: String((e as Error).message) });
      }
    }
  }

  if (req.method === 'POST' && pathname === '/api/search') {
    const { query } = await readBody(req);
    if (!query) return send(res, 400, { error: 'query required' });

    // A pasted news link: read the article, extract the scenario, run bull
    // and bear. The slug comes from the URL so the run is pollable at once.
    if (/^https?:\/\//i.test(String(query).trim())) {
      if (CONFIG.llm.provider === 'fixture') {
        return send(res, 200, { status: 'needs_model', message: 'Reading an article needs a model provider (LLM_PROVIDER).' });
      }
      const u = new URL(String(query).trim());
      const runId = slugify('news ' + u.hostname.replace(/^www\./, '') + ' ' + u.pathname).slice(0, 60) || 'news-run';
      if (hasRun(runId)) return send(res, 200, { runId, status: 'ready' });
      if (!takeQuota(userEmail)) return send(res, 429, { error: QUOTA_MSG });
      jobs.set(runId, { status: 'running' });
      save(runId, 'run', { seed: 'Reading the article and extracting the scenario', sourceUrl: u.toString(), createdAt: new Date().toISOString() });
      runFromArticle(runId, u.toString())
        .then(() => jobs.set(runId, { status: 'ready' }))
        .catch((e) => jobs.set(runId, { status: 'error', error: String(e?.message ?? e) }));
      return send(res, 202, { runId, status: 'running' });
    }

    const existing = findExistingRun(query);
    if (existing) return send(res, 200, { runId: existing, status: 'ready' });

    // A novel query needs the model. In fixture mode there are no fixtures for it,
    // so say so plainly rather than failing mid-run.
    if (CONFIG.llm.provider === 'fixture') {
      return send(res, 200, {
        status: 'needs_model',
        message:
          'No cached run for this query. Configure a local model (LLM_PROVIDER=ollama with a pulled model) ' +
          'or a hosted one (LLM_PROVIDER=openai) to run a new search.',
      });
    }

    const runId = slugify(query);
    if (!takeQuota(userEmail)) return send(res, 429, { error: QUOTA_MSG });
    jobs.set(runId, { status: 'running' });
    save(runId, 'run', { seed: query, createdAt: new Date().toISOString() });
    runAll(runId, query)
      .then(() => jobs.set(runId, { status: 'ready' }))
      .catch((e) => jobs.set(runId, { status: 'error', error: String(e?.message ?? e) }));
    return send(res, 202, { runId, status: 'running' });
  }

  send(res, 404, { error: 'not found' });
}

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT} (provider=${CONFIG.llm.provider})`);
});
