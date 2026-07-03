import fs from 'node:fs';
import path from 'node:path';
import { runDir } from './lib/store.js';
import { checkAlerts } from './pipeline/alerts.js';
import { decompose, drill } from './pipeline/decompose.js';
import { draftTheses } from './pipeline/draft.js';
import { enrich } from './pipeline/enrich.js';
import { mapTickers } from './pipeline/map.js';
import { writeMemo } from './pipeline/memo.js';
import { runAll, runCounter } from './pipeline/orchestrate.js';
import { overlay } from './pipeline/overlay.js';
import { buildPayload } from './pipeline/payload.js';
import { readFilings } from './pipeline/read.js';
import { score } from './pipeline/score.js';
import { CONFIG } from './config.js';

// Usage:
//   npm run stage -- decompose <slug> "<scenario>"
//   npm run stage -- map|enrich|read|score|draft|publish|memo|alerts|counter <slug>
//   npm run stage -- drill <slug> <nodeId>
//   npm run stage -- overlay <slug> "<fund name or CIK>"
//   npm run dry-run -- <slug> "<scenario>"           (all stages)
// Each stage writes data/runs/<slug>/<stage>.json so every intermediate is inspectable.
// ASOF=YYYY-MM-DD bounds full-text search at a past date (filings-only backtest).

function publish(slug: string) {
  const out = path.resolve('web/public/data/latest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(buildPayload(slug), null, 2));
  console.log(`[publish] ${path.relative(process.cwd(), out)}`);
}

const [stage, slug, arg] = process.argv.slice(2);
if (!stage || !slug) {
  console.error('usage: tsx src/run.ts <stage> <slug> [scenario | nodeId | fund]');
  process.exit(1);
}

const stages: Record<string, () => Promise<unknown> | unknown> = {
  decompose: () => decompose(slug, arg ?? missingArg('a scenario')),
  map: () => mapTickers(slug),
  enrich: () => enrich(slug),
  read: () => readFilings(slug),
  score: () => score(slug),
  draft: () => draftTheses(slug),
  publish: () => publish(slug),
  memo: () => writeMemo(slug),
  alerts: () => checkAlerts(slug),
  counter: () => runCounter(slug),
  overlay: () => overlay(slug, arg ?? missingArg('a fund name or CIK')),
  drill: async () => {
    const children = await drill(slug, arg ?? missingArg('a nodeId'));
    await mapTickers(slug, children.map((n) => n.id));
  },
  all: async () => {
    await runAll(slug, arg ?? missingArg('a scenario'));
    publish(slug);
  },
};

function missingArg(what: string): never {
  console.error(`this stage needs ${what} as the third argument`);
  process.exit(1);
}

const fn = stages[stage];
if (!fn) {
  console.error(`unknown stage "${stage}"`);
  process.exit(1);
}
console.log(`[run] stage=${stage} slug=${slug} dir=${runDir(slug)} provider=${CONFIG.llm.provider}`);
await fn();
