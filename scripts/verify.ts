// npm run verify: the pre-demo integrity harness. Checks schemas, stale
// artifacts, ticker currency, money formatting, old-run compatibility, memo
// sections, and corpus consistency. Exits non-zero on any failure so it can
// gate a deploy or a demo rehearsal.
import fs from 'node:fs';
import path from 'node:path';
import { buildPayload } from '../src/pipeline/payload.js';
import { buildMemo } from '../src/pipeline/memo.js';

const RUNS = path.resolve('data/runs');
const failures: string[] = [];
const warnings: string[] = [];
function fail(msg: string) {
  failures.push(msg);
  console.log(`  FAIL ${msg}`);
}
function warn(msg: string) {
  warnings.push(msg);
  console.log(`  warn ${msg}`);
}
function ok(msg: string) {
  console.log(`  ok   ${msg}`);
}

function runDirs(): string[] {
  return fs
    .readdirSync(RUNS)
    .filter((d) => d !== 'hermes' && fs.existsSync(path.join(RUNS, d, 'theses.json')));
}

function loadJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// 1. Schemas: every complete run has coherent stage artifacts.
console.log('== schemas ==');
for (const slug of runDirs()) {
  const d = path.join(RUNS, slug);
  try {
    const run = loadJson(path.join(d, 'run.json'));
    if (!run.seed) fail(`${slug}: run.json has no seed`);
    const dec = loadJson(path.join(d, 'decompose.json'));
    const nodes = dec.nodes ?? [];
    if (!nodes.length) fail(`${slug}: no nodes`);
    for (const n of nodes) {
      for (const f of ['id', 'name', 'mechanism', 'order', 'polarity', 'horizon']) {
        if (n[f] === undefined || n[f] === '') fail(`${slug}: node ${n.id ?? '?'} missing ${f}`);
      }
    }
    const reads = loadJson(path.join(d, 'reads.json'));
    for (const r of reads) {
      if (!r.ticker || !['direct', 'adjacent', 'peripheral'].includes(r.exposure))
        fail(`${slug}: read ${r.ticker ?? '?'} bad exposure`);
      if (!Array.isArray(r.quotes)) fail(`${slug}: read ${r.ticker} has no quotes array`);
    }
    const doss = loadJson(path.join(d, 'dossiers.json'));
    for (const x of doss) {
      if (!x.insider || !x.fundamentals || !x.reality) fail(`${slug}: dossier ${x.ticker} missing core blocks`);
    }
    const scores = loadJson(path.join(d, 'scores.json'));
    for (const r of reads) {
      if (scores[r.ticker] === undefined) fail(`${slug}: no score for ${r.ticker}`);
    }
    ok(`${slug}: ${nodes.length} nodes, ${reads.length} reads, ${doss.length} dossiers`);
  } catch (e) {
    fail(`${slug}: ${String((e as Error).message).slice(0, 100)}`);
  }
}

// 2. Stale artifacts: a tracked memo older than the newest stage output means
// someone changed the run without regenerating the memo.
console.log('== stale artifacts ==');
for (const slug of runDirs()) {
  const d = path.join(RUNS, slug);
  const memoPath = path.join(d, 'memo.html');
  if (!fs.existsSync(memoPath)) {
    warn(`${slug}: no memo.html on disk (server builds fresh per request)`);
    continue;
  }
  const memoTime = fs.statSync(memoPath).mtimeMs;
  const newest = Math.max(
    ...['decompose.json', 'dossiers.json', 'reads.json', 'scores.json', 'theses.json']
      .map((f) => path.join(d, f))
      .filter((p) => fs.existsSync(p))
      .map((p) => fs.statSync(p).mtimeMs),
  );
  if (memoTime < newest) fail(`${slug}: memo.html is older than the run stages`);
  else ok(`${slug}: memo fresh`);
}

// 3. Ticker/CIK matching against the SEC map, and the map itself must be fresh.
console.log('== ticker currency ==');
const mapPath = path.resolve('data/cache/company_tickers.json');
if (!fs.existsSync(mapPath)) {
  fail('company_tickers.json cache missing');
} else {
  const ageDays = (Date.now() - fs.statSync(mapPath).mtimeMs) / 86_400_000;
  if (ageDays > 7) fail(`ticker map cache is ${ageDays.toFixed(1)} days old; refresh it (delete the file, any run refetches)`);
  else ok(`ticker map cache ${ageDays.toFixed(1)} days old`);
  const map = loadJson(mapPath);
  const valid = new Set<string>(Object.values(map).map((r: any) => String(r.ticker).toUpperCase()));
  for (const slug of runDirs()) {
    const reads = loadJson(path.join(RUNS, slug, 'reads.json'));
    const stale = reads.filter((r: any) => !valid.has(String(r.ticker).toUpperCase())).map((r: any) => r.ticker);
    if (stale.length) fail(`${slug}: stale tickers ${stale.join(', ')}`);
    else ok(`${slug}: all ${reads.length} read tickers current`);
  }
}

// 4. Money formatting: no MM convention and no em/en dashes in generated text.
console.log('== money formatting and voice ==');
const mmPattern = /\$[\d,.]+\s?MM\b/;
for (const slug of runDirs()) {
  const d = path.join(RUNS, slug);
  const texts: Array<[string, string]> = [];
  const thesesDir = path.join(d, 'theses');
  if (fs.existsSync(thesesDir)) {
    for (const f of fs.readdirSync(thesesDir)) texts.push([`theses/${f}`, fs.readFileSync(path.join(thesesDir, f), 'utf8')]);
  }
  const doss = loadJson(path.join(d, 'dossiers.json'));
  texts.push(['dossiers.json flags', JSON.stringify(doss.map((x: any) => x.reality?.flags ?? []))]);
  let bad = 0;
  for (const [name, t] of texts) {
    if (mmPattern.test(t)) {
      fail(`${slug}/${name}: MM-convention dollars remain`);
      bad++;
    }
    if (/[—–]/.test(t)) {
      fail(`${slug}/${name}: em/en dash`);
      bad++;
    }
  }
  if (!bad) ok(`${slug}: theses and flags clean`);
}

// 5. Old-run compatibility: every run builds a payload without throwing, and
// the bundled static fallback parses with the expected keys.
console.log('== payload compatibility ==');
for (const slug of runDirs()) {
  try {
    const p = buildPayload(slug);
    if (!p.run?.seed || !Array.isArray(p.chain)) fail(`${slug}: payload malformed`);
    else ok(`${slug}: payload builds (${p.chain.length} nodes, ${p.theses.length} theses)`);
  } catch (e) {
    fail(`${slug}: buildPayload threw: ${String((e as Error).message).slice(0, 80)}`);
  }
}
const fallback = path.resolve('web/public/data/latest.json');
if (!fs.existsSync(fallback)) warn('static fallback web/public/data/latest.json missing');
else {
  try {
    const f = loadJson(fallback);
    if (!f.run?.seed || !Array.isArray(f.chain)) fail('static fallback malformed');
    else ok(`static fallback parses (seed: ${String(f.run.seed).slice(0, 40)})`);
    if (mmPattern.test(JSON.stringify(f))) fail('static fallback carries MM-convention dollars');
  } catch {
    fail('static fallback is not valid JSON');
  }
}

// 6. Memo sections: every run's freshly built memo carries the required
// sections, TRACE sections included when the run has the data.
console.log('== memo sections ==');
for (const slug of runDirs()) {
  try {
    const html = buildMemo(slug);
    for (const section of ['Consequence map', 'Ranked names', 'Rubric', 'Theses']) {
      if (!html.includes(section)) fail(`${slug}: memo missing section ${section}`);
    }
    const dec = loadJson(path.join(RUNS, slug, 'decompose.json'));
    if (dec.trigger && !html.includes('Trigger')) fail(`${slug}: run has trigger, memo does not`);
    if ((dec.reactions ?? []).length && !html.includes('Who reacts')) fail(`${slug}: run has reactions, memo does not`);
    if (mmPattern.test(html)) fail(`${slug}: memo carries MM-convention dollars`);
    if (/[—–]/.test(html)) fail(`${slug}: memo carries em/en dash`);
    if (!/Corpus: [\d,]+ US filers/.test(html)) warn(`${slug}: memo missing derived corpus count`);
    ok(`${slug}: memo sections complete`);
  } catch (e) {
    fail(`${slug}: buildMemo threw: ${String((e as Error).message).slice(0, 80)}`);
  }
}

// 7. Corpus consistency: the index, the card files, and the count all agree.
console.log('== corpus ==');
try {
  const index = loadJson(path.resolve('data/corpus/index.json'));
  const cards = fs.readdirSync(path.resolve('data/corpus/cards')).filter((f) => f.endsWith('.json'));
  const indexCount = Object.keys(index).length;
  if (indexCount !== cards.length)
    fail(`corpus index has ${indexCount} entries but ${cards.length} card files exist`);
  else ok(`corpus consistent: ${indexCount} filers (derived, never hand-written)`);
} catch (e) {
  fail(`corpus check threw: ${String((e as Error).message).slice(0, 80)}`);
}

// 8. Model-call provenance: every run generated after the provenance ship
// carries model-calls.jsonl; older runs warn.
console.log('== provenance ==');
for (const slug of runDirs()) {
  const p = path.join(RUNS, slug, 'model-calls.jsonl');
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').trim().split('\n').length;
    ok(`${slug}: ${lines} model calls logged`);
  } else {
    warn(`${slug}: no model-calls.jsonl (run predates provenance logging)`);
  }
}

console.log('');
console.log(`verify: ${failures.length} failure(s), ${warnings.length} warning(s)`);
if (failures.length) process.exit(1);
