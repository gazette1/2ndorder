// Live spot test for the evidence layer. Run: npx tsx scripts/test-evidence.ts
import { corporateEvents, earningsLanguage } from '../src/lib/events.js';
import { stakeDisclosures } from '../src/lib/holders.js';
import { governance } from '../src/lib/governance.js';
import { macroContext } from '../src/lib/macro.js';
import { hiringSnapshot } from '../src/lib/jobs.js';

const OLN = '0000074303'; // Olin Corp, active filer with 8-Ks, 13Gs, proxy
const slug = 'evidence-test';

const events = await corporateEvents(OLN);
console.log('EVENTS:', events.length);
for (const e of events.slice(0, 4)) console.log(' ', e.filedAt, e.signal ? '[signal]' : '', e.items.map((i) => i.label).join(' + '));

const holders = await stakeDisclosures(OLN);
console.log('HOLDERS:', holders.length);
for (const h of holders.slice(0, 4)) console.log(' ', h.form, h.holder, h.percent !== null ? h.percent + '%' : '(pct unparsed)', h.filedAt);

const lang = await earningsLanguage(slug, 'OLN', OLN);
console.log('EARNINGS LANGUAGE:', JSON.stringify(lang, null, 1));

const gov = await governance(slug, 'OLN', OLN);
console.log('GOVERNANCE:', JSON.stringify(gov, null, 1));

const macro = await macroContext(slug, 'US data center electricity demand doubling by 2028, driving grid infrastructure investment');
console.log('MACRO:', JSON.stringify(macro, null, 1));

const hiring = (await hiringSnapshot('Olin Corporation', 'OLN')) ?? (await hiringSnapshot('Datadog, Inc.', 'DDOG'));
console.log('HIRING (OLN, else DDOG):', JSON.stringify(hiring));
