import { CONFIG } from '../config.js';
import { load } from '../lib/store.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { RunPayload } from '../types.js';

function tryLoad<T>(slug: string, name: string, fallback: T): T {
  try {
    return load<T>(slug, name);
  } catch {
    return fallback;
  }
}

// The full run payload the front end reads. Shared by the CLI publish stage and
// the API server, so both emit exactly the same shape. Later stages (reads,
// theses) default empty so a partially complete run still renders as a map.
export function buildPayload(slug: string): RunPayload {
  const run = load<{ seed: string; createdAt: string; asof?: string | null; counterOf?: string | null }>(slug, 'run');
  return {
    run: {
      id: slug,
      seed: run.seed,
      createdAt: run.createdAt,
      capBandMM: CONFIG.capBandMM,
      mode: CONFIG.llm.provider === 'fixture' ? 'fixture' : 'live',
      rubric,
      asof: run.asof ?? null,
      counterOf: run.counterOf ?? null,
    },
    chain: load<any>(slug, 'decompose').nodes,
    candidates: tryLoad<any>(slug, 'candidates', []),
    dossiers: tryLoad<any>(slug, 'dossiers', []),
    reads: tryLoad<any>(slug, 'reads', []),
    theses: tryLoad<any>(slug, 'theses', []),
  };
}
