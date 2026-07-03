import fs from 'node:fs';
import path from 'node:path';
import { runDir } from './lib/store.js';
import { decompose } from './pipeline/decompose.js';
import { draftTheses } from './pipeline/draft.js';
import { enrich } from './pipeline/enrich.js';
import { mapTickers } from './pipeline/map.js';
import { runAll } from './pipeline/orchestrate.js';
import { buildPayload } from './pipeline/payload.js';
import { readFilings } from './pipeline/read.js';
import { score } from './pipeline/score.js';
import { CONFIG } from './config.js';

// Usage:
//   npm run stage -- decompose <slug> "<seed thesis>"
//   npm run stage -- map|enrich|read|score|draft|publish <slug>
//   npm run dry-run -- <slug> "<seed thesis>"      (all stages)
// Each stage writes data/runs/<slug>/<stage>.json so every intermediate is inspectable.

function publish(slug: string) {
  const out = path.resolve('web/public/data/latest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(buildPayload(slug), null, 2));
  console.log(`[publish] ${path.relative(process.cwd(), out)}`);
}

const [stage, slug, seed] = process.argv.slice(2);
if (!stage || !slug) {
  console.error('usage: tsx src/run.ts <decompose|map|enrich|read|score|draft|publish|all> <slug> ["seed thesis"]');
  process.exit(1);
}

const stages: Record<string, () => Promise<unknown> | void> = {
  decompose: () => decompose(slug, seed ?? missingSeed()),
  map: () => mapTickers(slug),
  enrich: () => enrich(slug),
  read: () => readFilings(slug),
  score: () => score(slug),
  draft: () => draftTheses(slug),
  publish: () => publish(slug),
  all: async () => {
    await runAll(slug, seed ?? missingSeed());
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
console.log(`[run] stage=${stage} slug=${slug} dir=${runDir(slug)} provider=${CONFIG.llm.provider}`);
await fn();
