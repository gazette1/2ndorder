import { load, save } from '../src/lib/store.js';
import { companySic } from '../src/lib/edgar.js';
import { regulatorSignal } from '../src/lib/regulators.js';
import type { Dossier } from '../src/types.js';
import { load as loadRun } from '../src/lib/store.js';

const slug = 'evidence-live';
const dossiers = load<Dossier[]>(slug, 'dossiers');
const candidates = load<Array<{ ticker: string; name: string }>>(slug, 'candidates');
for (const d of dossiers) {
  const name = candidates.find((c) => c.ticker === d.ticker)?.name ?? d.ticker;
  const prof = await companySic(d.cik);
  d.regulator = await regulatorSignal(prof.sic, name);
  console.log(d.ticker, prof.sic, '->', d.regulator ? `${d.regulator.agency}: ${d.regulator.headline}` : 'none');
}
save(slug, 'dossiers', dossiers);
