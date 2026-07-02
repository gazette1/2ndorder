import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { load, runDir } from './lib/store.js';
import { decompose } from './pipeline/decompose.js';
import { draftTheses } from './pipeline/draft.js';
import { mapTickers } from './pipeline/map.js';
import { readFilings } from './pipeline/read.js';
import { score } from './pipeline/score.js';
import rubric from './rubric.json' with { type: 'json' };
import type { RunPayload } from './types.js';

// Usage:
//   npm run stage -- decompose <slug> "<seed thesis>"
//   npm run stage -- map|read|score|draft|publish <slug>
//   npm run dry-run -- <slug> "<seed thesis>"      (all stages)
// Each stage writes data/runs/<slug>/<stage>.json so every intermediate is inspectable.

function publish(slug: string) {
  const run = load<{ seed: string; createdAt: string }>(slug, 'run');
  const payload: RunPayload = {
    run: {
      id: slug,
      seed: run.seed,
      createdAt: run.createdAt,
      floatBandMM: CONFIG.floatBandMM,
      mode: process.env.ANTHROPIC_API_KEY ? 'live' : 'fixture',
      rubric,
    },
    chain: load<any>(slug, 'decompose').nodes,
    candidates: load<any>(slug, 'candidates'),
    reads: load<any>(slug, 'reads'),
    theses: load<any>(slug, 'theses'),
  };
  const out = path.resolve('web/public/data/latest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`[publish] ${path.relative(process.cwd(), out)}`);
}

const [stage, slug, seed] = process.argv.slice(2);
if (!stage || !slug) {
  console.error('usage: tsx src/run.ts <decompose|map|read|score|draft|publish|all> <slug> ["seed thesis"]');
  process.exit(1);
}

const stages: Record<string, () => Promise<unknown> | void> = {
  decompose: () => decompose(slug, seed ?? missingSeed()),
  map: () => mapTickers(slug),
  read: () => readFilings(slug),
  score: () => score(slug),
  draft: () => draftTheses(slug),
  publish: () => publish(slug),
  all: async () => {
    await decompose(slug, seed ?? missingSeed());
    await mapTickers(slug);
    await readFilings(slug);
    await score(slug);
    await draftTheses(slug);
    publish(slug);
  },
};

function missingSeed(): never {
  console.error('decompose needs a seed thesis as the third argument');
  process.exit(1);
}

const fn = stages[stage];
if (!fn) {
  console.error(`unknown stage "${stage}"`);
  process.exit(1);
}
console.log(`[run] stage=${stage} slug=${slug} dir=${runDir(slug)} mode=${process.env.ANTHROPIC_API_KEY ? 'live' : 'fixture'}`);
await fn();
