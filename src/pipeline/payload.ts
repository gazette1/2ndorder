import { CONFIG } from '../config.js';
import { load } from '../lib/store.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { RunPayload } from '../types.js';

// The full run payload the front end reads. Shared by the CLI publish stage and
// the API server, so both emit exactly the same shape.
export function buildPayload(slug: string): RunPayload {
  const run = load<{ seed: string; createdAt: string }>(slug, 'run');
  return {
    run: {
      id: slug,
      seed: run.seed,
      createdAt: run.createdAt,
      floatBandMM: CONFIG.floatBandMM,
      mode: CONFIG.llm.provider === 'fixture' ? 'fixture' : 'live',
      rubric,
    },
    chain: load<any>(slug, 'decompose').nodes,
    candidates: load<any>(slug, 'candidates'),
    dossiers: load<any>(slug, 'dossiers'),
    reads: load<any>(slug, 'reads'),
    theses: load<any>(slug, 'theses'),
  };
}
