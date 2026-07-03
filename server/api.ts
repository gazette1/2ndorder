import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config.js';
import { checkAlerts } from '../src/pipeline/alerts.js';
import { drill } from '../src/pipeline/decompose.js';
import { mapTickers } from '../src/pipeline/map.js';
import { buildMemo } from '../src/pipeline/memo.js';
import { runAll, runCounter } from '../src/pipeline/orchestrate.js';
import { overlay } from '../src/pipeline/overlay.js';
import { buildPayload } from '../src/pipeline/payload.js';
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

function authed(req: http.IncomingMessage): boolean {
  return (req.headers.authorization ?? '').startsWith('Bearer ');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => send(res, 500, { error: String((e as Error).message ?? e) }));
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') return send(res, 204, {});

  // Mock login: any email is accepted and gets a token. Swap for Supabase Auth.
  if (req.method === 'POST' && pathname === '/api/login') {
    const { email } = await readBody(req);
    if (!email) return send(res, 400, { error: 'email required' });
    return send(res, 200, { token: Buffer.from(`${email}:${Date.now()}`).toString('base64'), email });
  }

  // Everything below requires a session.
  if (!authed(req)) return send(res, 401, { error: 'sign in first' });

  if (req.method === 'GET' && pathname === '/api/runs') {
    return send(res, 200, { runs: listRuns() });
  }

  // /api/runs/:id and /api/runs/:id/<action>
  if (pathname.startsWith('/api/runs/')) {
    const [id, action] = pathname.slice('/api/runs/'.length).split('/');

    if (req.method === 'GET' && !action) {
      const job = jobs.get(id);
      if (job && job.status !== 'ready') return send(res, 200, { status: job.status, error: job.error });
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
