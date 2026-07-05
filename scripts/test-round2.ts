import { macroContext } from '../src/lib/macro.js';
import { corporateEvents } from '../src/lib/events.js';
import { insiderSummary } from '../src/lib/edgar.js';

// FOMC + industry pick + expanded series on a freight scenario
const m = await macroContext('evidence-test', 'Long-haul trucking capacity exits the market as freight rates stay below operating cost');
console.log('SERIES:', m?.series.map((s) => `${s.label} ${s.latest} (${s.yoyPct}% yoy)`).join(' | '));
console.log('FOMC:', m?.fomc ? `${m.fomc.date}: ${m.fomc.stance}` : 'none');
console.log('INDUSTRY:', m?.industry ? JSON.stringify(m.industry) : 'none (expected without CENSUS_API_KEY)');

// Exhibit links on OLN events
const ev = await corporateEvents('0000074303');
for (const e of ev.slice(0, 4)) console.log('EVENT', e.filedAt, e.items.map((i) => i.code).join(','), 'exhibit:', e.exhibitUrl ? 'yes' : 'no');

// Form 144 on a name with regular insider selling (NVDA)
const ins = await insiderSummary('0001045810');
console.log('NVDA form144Count90d:', ins.form144Count90d, 'latest:', ins.form144LatestDate);
