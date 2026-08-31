import { save } from '../src/lib/store.js';
import { runAll, runCounter } from '../src/pipeline/orchestrate.js';
import { writeMemo } from '../src/pipeline/memo.js';

const slug = process.argv[2];
const seed = process.argv[3];
if (!slug || !seed) throw new Error('usage: refresh-demo.ts <slug> <seed>');
save(slug, 'run', { seed, createdAt: new Date().toISOString() });
await runAll(slug, seed);
writeMemo(slug);
if (process.argv[4] === 'counter') {
  const c = await runCounter(slug);
  writeMemo(c);
}
console.log('REFRESH DONE:', slug);
