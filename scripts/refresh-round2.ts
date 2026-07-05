import { load, save } from '../src/lib/store.js';
import { macroContext } from '../src/lib/macro.js';
import { corporateEvents } from '../src/lib/events.js';
import { insiderSummary } from '../src/lib/edgar.js';
import { writeMemo } from '../src/pipeline/memo.js';
import type { Dossier } from '../src/types.js';

const slug = 'evidence-live';
const seed = 'Reshoring of pharmaceutical ingredient manufacturing to the US accelerates under tariff and supply-security policy';

const macro = await macroContext(slug, seed);
if (macro) {
  save(slug, 'macro', macro);
  console.log('FOMC:', macro.fomc ? macro.fomc.date : 'none');
  console.log('INDUSTRY:', macro.industry ? macro.industry.label : 'none (no census key)');
  console.log('SERIES:', macro.series.map((s) => s.id).join(', '));
}

const dossiers = load<Dossier[]>(slug, 'dossiers');
for (const d of dossiers) {
  d.events = await corporateEvents(d.cik).catch(() => d.events ?? []);
  d.insider = await insiderSummary(d.cik).catch(() => d.insider);
  const ex = (d.events ?? []).filter((e) => e.exhibitUrl).length;
  console.log(d.ticker, ':', ex, 'exhibit links,', d.insider.form144Count90d ?? 0, 'x 144 (90d)');
}
save(slug, 'dossiers', dossiers);
writeMemo(slug);
