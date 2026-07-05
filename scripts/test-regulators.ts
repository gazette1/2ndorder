import { companySic, tickerMap } from '../src/lib/edgar.js';
import { regulatorSignal, regulatorFor } from '../src/lib/regulators.js';

const map = await tickerMap();
const byTicker = new Map([...map.values()].map((v, i) => [v.ticker, [...map.keys()][i]] as const));
// AQST: pharma (FDA). CHTR: cable (FCC). WMB: gas pipelines (FERC).
for (const t of ['AQST', 'CHTR', 'WMB']) {
  const cik = byTicker.get(t);
  if (!cik) { console.log(t, 'not in map'); continue; }
  const v = map.get(cik)!;
  const prof = await companySic(cik);
  console.log(`${t} SIC ${prof.sic} (${prof.sicDescription}) -> ${regulatorFor(prof.sic) ?? 'none'}`);
  const sig = await regulatorSignal(prof.sic, v.title);
  if (sig) {
    console.log('  headline:', sig.headline);
    for (const i of sig.items) console.log('  -', i.date ?? '', i.text.slice(0, 110));
  } else {
    console.log('  no signal (unregulated sector or skipped)');
  }
}
