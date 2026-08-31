// One-time rewrite of stored filterReason strings to the K/M/B convention.
import fs from 'node:fs';
import path from 'node:path';
import { fmtCapMM } from '../src/lib/money.js';
import { buildPayload } from '../src/pipeline/payload.js';

const RUNS = path.resolve('data/runs');
for (const slug of fs.readdirSync(RUNS)) {
  const p = path.join(RUNS, slug, 'candidates.json');
  if (!fs.existsSync(p)) continue;
  const cands = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = 0;
  for (const c of cands) {
    const m = /^market cap \$(\d+)MM outside \$(\d+)MM to \$(\d+)MM band$/.exec(c.filterReason ?? '');
    if (m) {
      c.filterReason = `market cap ${fmtCapMM(Number(m[1]))} outside ${fmtCapMM(Number(m[2]))} to ${fmtCapMM(Number(m[3]))} band`;
      changed++;
    }
  }
  if (changed) {
    fs.writeFileSync(p, JSON.stringify(cands, null, 2));
    console.log(`${slug}: ${changed} filterReason strings rewritten`);
  }
}
fs.writeFileSync(path.resolve('web/public/data/latest.json'), JSON.stringify(buildPayload('grid-capex')));
console.log('fallback refreshed');
