// Regenerate theses and macro for evidence-live with the fixed prompt and lint.
import { draftTheses } from '../src/pipeline/draft.js';
import { macroContext } from '../src/lib/macro.js';
import { save } from '../src/lib/store.js';
import { writeMemo } from '../src/pipeline/memo.js';

const slug = 'evidence-live';
const macro = await macroContext(slug, 'Reshoring of pharmaceutical ingredient manufacturing to the US accelerates under tariff and supply-security policy');
if (macro) {
  save(slug, 'macro', macro);
  console.log('MACRO:', macro.series.map((s) => `${s.label}: ${s.latest} (${s.yoyPct}% yoy)`).join(' | '));
}
await draftTheses(slug);
writeMemo(slug);
