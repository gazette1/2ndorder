// Day 1 acceptance test: the AP tariff article must produce validated,
// article-grounded trigger facts with zero invented numbers.
import fs from 'node:fs';
import { fetchArticleText } from '../src/lib/article.js';
import { extractTriggerContract } from '../src/pipeline/trigger.js';

const URL = 'https://apnews.com/article/trump-tariffs-canada-us-trade-war-293908564c7a381ea58a61db6e9a8517';
const slug = 'day1-acceptance';
fs.mkdirSync('data/runs/' + slug, { recursive: true });
fs.writeFileSync('data/runs/' + slug + '/run.json', JSON.stringify({ seed: 'day1 acceptance', createdAt: new Date().toISOString() }));

const article = await fetchArticleText(URL);
console.log('article chars:', article.text.length);
const tc = await extractTriggerContract(slug, article);

const checks: Array<[string, boolean]> = [
  ['50% rate captured', (tc.rates.value ?? []).some((r) => r.includes('50'))],
  ['no invented 10-25 range', !(JSON.stringify(tc.rates) + JSON.stringify(tc.unsupportedClaims)).includes('10 to 25')],
  ['monetary scope ~$20B', (tc.monetaryScope.value ?? []).some((m) => m.value === 20 && m.unit.includes('billion'))],
  ['status effective', tc.status === 'effective'],
  ['retaliation separated', tc.response !== null && /Sept|September/.test(String(tc.response?.announcedDate ?? '') + String(tc.response?.effectiveDate ?? '') + String(tc.response?.exactQuote ?? ''))],
  ['Section 338 authority', String(tc.legalAuthority.value ?? '').includes('338')],
  ['targeted products present', (tc.targetedProducts.value ?? []).length > 0],
  ['no generic 2025-2026 timing', !JSON.stringify(tc).includes('2025-2026')],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
console.log('contract summary:', JSON.stringify({ rates: tc.rates.value, scope: tc.monetaryScope.value, status: tc.status, authority: tc.legalAuthority.value, response: tc.response?.actor }, null, 1));
if (failed) { console.log(`DAY1 ACCEPTANCE: ${failed} FAILURES`); process.exit(1); }
console.log('DAY1 ACCEPTANCE: ALL PASS');
