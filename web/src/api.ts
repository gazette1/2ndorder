// API client for the backend (node:http on http://localhost:8787, proxied
// at /api in dev). Every non-login route carries a Bearer token. A network
// failure (server not running) is surfaced as NetworkError so callers can fall
// back to the bundled demo payload.

import type { Alert, ChainNode, Overlay, RawChainNode, RunPayload } from './types';

export class NetworkError extends Error {}
export class AuthError extends Error {}

// Message shown when a run action needs the API and it is not reachable.
export const OFFLINE_MSG = 'Needs the API server (npm run serve).';

export interface RunSummary {
  id: string;
  seed: string;
  createdAt: string;
  mode: string;
}

export type RunStatus =
  | { status: 'ready'; payload: RunPayload }
  | { status: 'running' };

export type SearchResult =
  | { status: 'ready'; runId: string }
  | { status: 'running'; runId: string }
  | { status: 'needs_model'; message: string };

export interface AlertsResult {
  generatedAt: string;
  since: string;
  alerts: Alert[];
}

export interface CounterResult {
  runId: string;
  status: 'running' | 'ready';
}

// Load-time normalizer. Old payloads carry a `layer` field on chain nodes and
// no order/polarity/parentId/mechanism/horizon. Map the old shape onto the
// consequence-tree shape so the app never crashes on an old run:
//   order    = layer === 'second_order' ? 2 : 1
//   polarity = layer === 'disrupted' ? 'at_risk' : 'beneficiary'
//   mechanism = '', horizon = 'mid', parentId = null
function normalizeNode(raw: RawChainNode): ChainNode {
  const order =
    typeof raw.order === 'number' && raw.order > 0
      ? raw.order
      : raw.layer === 'second_order'
        ? 2
        : 1;
  const polarity =
    raw.polarity === 'beneficiary' || raw.polarity === 'at_risk'
      ? raw.polarity
      : raw.layer === 'disrupted'
        ? 'at_risk'
        : 'beneficiary';
  const horizon =
    raw.horizon === 'near' || raw.horizon === 'mid' || raw.horizon === 'long'
      ? raw.horizon
      : 'mid';
  return {
    id: raw.id,
    parentId: raw.parentId ?? null,
    order,
    polarity,
    name: raw.name,
    mechanism: typeof raw.mechanism === 'string' ? raw.mechanism : '',
    logic: raw.logic ?? '',
    horizon,
    searchPhrases: raw.searchPhrases ?? [],
    filingHits: raw.filingHits,
    whiteSpace: raw.whiteSpace,
  };
}

export function normalizeRunPayload(raw: unknown): RunPayload {
  const p = raw as Partial<RunPayload> & { chain?: RawChainNode[] };
  const run = (p.run ?? {}) as Partial<RunPayload['run']> & Record<string, unknown>;
  return {
    run: {
      id: run.id ?? '',
      seed: run.seed ?? '',
      createdAt: run.createdAt ?? '',
      // Old payloads sized by public float; new ones by market cap.
      capBandMM: run.capBandMM ?? (run.floatBandMM as [number, number] | undefined) ?? [0, 0],
      mode: run.mode === 'fixture' ? 'fixture' : 'live',
      rubric: run.rubric ?? { weights: {}, definitions: {} },
      asof: typeof run.asof === 'string' ? run.asof : null,
      counterOf: typeof run.counterOf === 'string' ? run.counterOf : null,
    },
    chain: (p.chain ?? []).map(normalizeNode),
    candidates: (p.candidates ?? []).map((c) => {
      const old = c as typeof c & { publicFloatMM?: number | null };
      return {
        ...c,
        marketCapMM: c.marketCapMM ?? old.publicFloatMM ?? null,
        capSource: c.capSource ?? (old.publicFloatMM !== undefined ? 'public_float' : null),
      };
    }),
    reads: p.reads ?? [],
    theses: p.theses ?? [],
    dossiers: p.dossiers ?? [],
  };
}

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new NetworkError(`Could not reach the API at ${path}`);
  }
  if (res.status === 401) {
    throw new AuthError('Session expired or invalid.');
  }
  return res;
}

export async function listRuns(token: string): Promise<RunSummary[]> {
  const res = await authedFetch('/api/runs', token);
  if (!res.ok) throw new Error(`List runs failed with status ${res.status}`);
  const data = (await res.json()) as { runs: RunSummary[] };
  return data.runs ?? [];
}

// GET /api/runs/:id. Returns null on 404. Ready payloads are normalized so old
// runs with layer-based nodes still render.
export async function getRun(token: string, runId: string): Promise<RunStatus | null> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Get run failed with status ${res.status}`);
  const data = (await res.json()) as
    | { status: 'ready'; payload: unknown }
    | { status: 'running' };
  if (data.status === 'ready') {
    return { status: 'ready', payload: normalizeRunPayload(data.payload) };
  }
  return data;
}

export async function search(token: string, query: string): Promise<SearchResult> {
  const res = await authedFetch('/api/search', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
  const data = (await res.json()) as
    | { runId: string; status: 'ready' | 'running' }
    | { status: 'needs_model'; message: string };
  if ('status' in data && data.status === 'needs_model') {
    return { status: 'needs_model', message: data.message };
  }
  return { status: data.status, runId: data.runId };
}

// GET /api/runs/:id/memo. The memo is HTML behind the Bearer header, so a
// plain link cannot open it. Fetch it, wrap it in a Blob URL, and let the
// caller window.open that URL.
export async function fetchMemoBlobUrl(token: string, runId: string): Promise<string> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}/memo`, token);
  if (res.status === 404) throw new NetworkError(OFFLINE_MSG);
  if (!res.ok) throw new Error(`Memo request failed with status ${res.status}`);
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}

// GET /api/runs/:id/alerts. With refresh=1 the server re-checks EDGAR live,
// which can take around 15 seconds. Without refresh it returns the cached
// result or 404 if alerts were never generated (surfaced here as null).
export async function fetchAlerts(
  token: string,
  runId: string,
  refresh: boolean,
): Promise<AlertsResult | null> {
  const qs = refresh ? '?refresh=1' : '';
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}/alerts${qs}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Alerts request failed with status ${res.status}`);
  return (await res.json()) as AlertsResult;
}

// POST /api/runs/:id/drill {nodeId}. Synchronous on the server side, can take
// 30 to 90 seconds. Resolves when the drill is done; the caller should then
// re-fetch the run payload to pick up new child nodes.
export async function drillNode(token: string, runId: string, nodeId: string): Promise<void> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}/drill`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId }),
  });
  if (res.status === 404) throw new NetworkError(OFFLINE_MSG);
  if (!res.ok) throw new Error(`Drill request failed with status ${res.status}`);
  await res.json().catch(() => undefined);
}

// POST /api/runs/:id/counter {}. Async: returns the counter run id, which the
// caller polls with getRun until ready.
export async function startCounter(token: string, runId: string): Promise<CounterResult> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}/counter`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (res.status === 404) throw new NetworkError(OFFLINE_MSG);
  if (!res.ok) throw new Error(`Counter request failed with status ${res.status}`);
  return (await res.json()) as CounterResult;
}

// POST /api/runs/:id/overlay {fund}. Synchronous, 10 to 30 seconds. fund is a
// fund name or a CIK.
export async function fetchOverlay(token: string, runId: string, fund: string): Promise<Overlay> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}/overlay`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fund }),
  });
  if (res.status === 404) throw new NetworkError(OFFLINE_MSG);
  if (!res.ok) throw new Error(`Overlay request failed with status ${res.status}`);
  return (await res.json()) as Overlay;
}

// Offline fallback: the demo payload bundled in public/data. Used when the API
// cannot be reached so the app always renders something. Normalized like a
// live payload so old-shape demo data still renders.
export async function fetchDemoPayload(): Promise<RunPayload> {
  const res = await fetch('/data/latest.json');
  if (!res.ok) throw new Error(`Demo data fetch failed with status ${res.status}`);
  return normalizeRunPayload(await res.json());
}
