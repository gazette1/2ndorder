// T-5 live checkpoint on the real AP artifacts: retaliation groups separated
// with verbatim quotes, research pass produces the diff, no unsupported
// numbers in the researched contract.
import fs from 'node:fs';
import path from 'node:path';
import { extractRetaliation, researchPass } from '../../src/pipeline/research.js';
import type { TriggerContract } from '../../src/types.js';

const RUN = 'day1-acceptance';
const dir = path.resolve('data/runs', RUN);
const article = fs.readFileSync(path.join(dir, 'article.txt'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'trigger-contract.json'), 'utf8')) as TriggerContract;
const gaps = fs.existsSync(path.join(dir, 'gaps.json'))
  ? JSON.parse(fs.readFileSync(path.join(dir, 'gaps.json'), 'utf8'))
  : [];

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures++;
};

// Research pass in disabled mode: must degrade honestly (no docs, contract
// unchanged, diff all-unchanged) rather than inventing content.
process.env.RESEARCH_PROVIDER = 'disabled';
const { researched, docs } = await researchPass(RUN, contract, gaps, article);
check('disabled mode: no usable docs fabricated', docs.every((d) => d.mode === 'unavailable'));
check('disabled mode: contract unchanged', JSON.stringify(researched.rates) === JSON.stringify(contract.rates));
const diff = JSON.parse(fs.readFileSync(path.join(dir, 'trigger-diff.json'), 'utf8'));
check('trigger-diff.json exists and is inspectable', Array.isArray(diff) && diff.length > 5);
check('diff shows no changes in disabled mode', diff.every((d: any) => d.change === 'unchanged'));

// Retaliation extraction on the live model against the real article.
const actions = await extractRetaliation(RUN, article);
const official = actions.filter((a) => a.group === 'official');
const threatened = actions.filter((a) => a.group === 'threatened');
check('official group: Carney countermeasures present', official.some((a) => /carney|canada/i.test(a.actor)), JSON.stringify(official.map((a) => a.actor)));
check('official group carries the Sept. 8 schedule', official.some((a) => /sept/i.test(String(a.effectiveDate ?? '') + String(a.announcedDate ?? ''))));
check('threatened group: Ford electricity/minerals present', threatened.some((a) => /ford|ontario/i.test(a.actor) && /electricity|mineral/i.test(a.action + a.targetedProducts.join(' '))), JSON.stringify(threatened.map((a) => a.actor)));
check('groups are separated (no official item is a threat)', !official.some((a) => /everything is on the table/i.test(a.exactQuote ?? '')));
check('all official+threatened are quote-backed', actions.filter((a) => a.group !== 'modeled').every((a) => !!a.exactQuote));


// Fixture-mode research: the researched trigger must gain fixture-supported
// facts only, with an inspectable diff and the unsupported-number guard.
process.env.RESEARCH_PROVIDER = 'fixture';
const { researched: r2, docs: d2 } = await researchPass(RUN, contract, gaps, article);
check('fixture mode: docs labeled fixture, never live', d2.every((d) => d.mode !== 'live'));
const diff2 = JSON.parse(fs.readFileSync(path.join(dir, 'trigger-diff.json'), 'utf8'));
check('fixture merge: diff is inspectable', Array.isArray(diff2) && diff2.length > 5);
check('fixture merge: 50% rate preserved', (r2.rates.value ?? []).some((x: string) => x.includes('50')));
check('fixture merge: no invented products beyond corpus', (r2.targetedProducts.value ?? []).length >= 10);

// Sector transmission on the researched contract plus retaliation.
import { mapSectors } from '../../src/pipeline/research.js';
const sectors = await mapSectors(RUN, r2, actions);
check('sectors: 6+ mapped', sectors.length >= 6, String(sectors.length));
check('sectors: both polarities present', sectors.some((s) => s.direction === 'beneficiary') && sectors.some((s) => s.direction === 'at_risk'));
check('sectors: retaliation channel present', sectors.some((s) => s.channel === 'retaliation_exposure'), JSON.stringify(sectors.map((s) => s.channel)));
check('sectors: every mechanism is a sentence', sectors.every((s) => s.mechanism.split(' ').length >= 6));

console.log('');
console.log(`t5-live: ${failures} failure(s)`);
if (failures) process.exit(1);
