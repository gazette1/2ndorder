// API client for the mock backend (node:http on http://localhost:8787, proxied
// at /api in dev). Every non-login route carries a Bearer token. A network
// failure (server not running) is surfaced as NetworkError so callers can fall
// back to the bundled demo payload.

import type { RunPayload } from './types';

export class NetworkError extends Error {}
export class AuthError extends Error {}

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

// GET /api/runs/:id. Returns null on 404.
export async function getRun(token: string, runId: string): Promise<RunStatus | null> {
  const res = await authedFetch(`/api/runs/${encodeURIComponent(runId)}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Get run failed with status ${res.status}`);
  const data = (await res.json()) as
    | { status: 'ready'; payload: RunPayload }
    | { status: 'running' };
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

// Offline fallback: the demo payload bundled in public/data. Used when the API
// cannot be reached so the app always renders something.
export async function fetchDemoPayload(): Promise<RunPayload> {
  const res = await fetch('/data/latest.json');
  if (!res.ok) throw new Error(`Demo data fetch failed with status ${res.status}`);
  return (await res.json()) as RunPayload;
}
