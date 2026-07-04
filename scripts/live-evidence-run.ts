import { save } from '../src/lib/store.js';
import { runAll } from '../src/pipeline/orchestrate.js';
import { buildPayload } from '../src/pipeline/payload.js';
import { writeMemo } from '../src/pipeline/memo.js';

const slug = 'evidence-live';
const seed = 'Reshoring of pharmaceutical ingredient manufacturing to the US accelerates under tariff and supply-security policy';
save(slug, 'run', { seed, createdAt: new Date().toISOString() });
await runAll(slug, seed);
const p = buildPayload(slug);
console.log('MACRO SERIES:', p.macro?.series.map((s) => `${s.id} ${s.latest} yoy ${s.yoyPct}`).join('; ') ?? 'none');
const d = p.dossiers[0];
if (d) {
  console.log(`FIRST DOSSIER ${d.ticker}: events ${d.events?.length}, holders ${d.holders?.length}, lang ${d.earningsLanguage ? 'yes' : 'no'}, proxy ${d.governance ? 'yes' : 'no'}, hiring ${d.hiring ? d.hiring.openRoles : 'none'}`);
}
writeMemo(slug);
