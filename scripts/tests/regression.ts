// Regression tests from master prompt section 40, steps 7-9.
// Run: npm run test. Exits non-zero on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { findUnsupportedNumbers, productScopeGate, classifyEventType } from '../../src/schema/v2.js';
import type { TriggerContract } from '../../src/types.js';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` :: ${detail}` : ''}`);
  if (!ok) failures++;
}

// ---------------------------------------------------------------------------
// Regression 1: the invented "10 to 25 percentage points" assumption from the
// preserved failed AP run must be caught by the unsupported-number scanner.
// ---------------------------------------------------------------------------
const OLD_RUN = path.resolve('data/runs/news-apnews-com-article-trump-tariffs-canada-us-trade-war-29');
const NEW_RUN = path.resolve('data/runs/day1-acceptance');

const oldDecompose = JSON.parse(fs.readFileSync(path.join(OLD_RUN, 'decompose.json'), 'utf8'));
const articleText = fs.readFileSync(path.join(NEW_RUN, 'article.txt'), 'utf8');

const oldTriggerText = JSON.stringify(oldDecompose.trigger ?? {});
const oldHits = findUnsupportedNumbers(oldTriggerText, articleText);
check(
  'old AP trigger: invented magnitudes are caught',
  oldHits.some((h) => h.token.includes('10') || h.token.includes('25')),
  `hits: ${JSON.stringify(oldHits.map((h) => h.token))}`,
);

const newContract = JSON.parse(fs.readFileSync(path.join(NEW_RUN, 'trigger-contract.json'), 'utf8')) as TriggerContract;
const newClaimText = [
  ...(newContract.rates.value ?? []),
  ...((newContract.monetaryScope.value ?? []).map((m) => `${m.value} ${m.unit}`)),
].join(' ');
const newHits = findUnsupportedNumbers(newClaimText, articleText);
check('new AP contract: all magnitudes source-supported', newHits.length === 0, JSON.stringify(newHits));

// ---------------------------------------------------------------------------
// Regression 2: INV-004 product-scope gate. A tariff contract with empty
// targeted products must block company mapping; with products it proceeds;
// a non-product event with empty products proceeds.
// ---------------------------------------------------------------------------
function contractFixture(overrides: Partial<TriggerContract>): TriggerContract {
  return {
    sourceUrl: 'fixture://test',
    publicationDate: null,
    eventDate: null,
    effectiveDate: null,
    primaryActor: 'US administration',
    action: 'imposes 50% tariffs on Canadian imports',
    counterparty: 'Canada',
    legalAuthority: { value: 'Section 338 of the Tariff Act of 1930', exactQuote: null, confidence: 'verified' },
    rates: { value: ['50%'], exactQuote: null, confidence: 'verified' },
    monetaryScope: { value: [], exactQuote: null, confidence: 'unknown' },
    targetedProducts: { value: [], exactQuote: null, confidence: 'unknown' },
    response: null,
    status: 'effective',
    reversibilityMechanisms: [],
    unsupportedClaims: [],
    ...overrides,
  };
}

const blocked = productScopeGate(contractFixture({}));
check('tariff with empty product scope is BLOCKED', !blocked.canProceedToCompanyMapping, blocked.reasons.join('; '));
check('gate classifies the event as tariff', blocked.eventType === 'tariff');

const resolved = productScopeGate(
  contractFixture({
    targetedProducts: { value: ['steel products', 'agricultural products'], exactQuote: 'x', confidence: 'verified' },
  }),
);
check('tariff with resolved product scope proceeds', resolved.canProceedToCompanyMapping, resolved.reasons.join('; '));

const partial = productScopeGate(
  contractFixture({
    targetedProducts: { value: ['goods ranging from hockey sticks to agricultural products'], exactQuote: null, confidence: 'unknown' },
  }),
);
check('partially resolved scope proceeds WITH warning', partial.canProceedToCompanyMapping && partial.warnings.length > 0);

const nonProduct = productScopeGate(
  contractFixture({ action: 'cuts the federal funds rate by 50 basis points', legalAuthority: { value: null, exactQuote: null, confidence: 'unknown' } }),
);
check('non-product event with empty products proceeds', nonProduct.canProceedToCompanyMapping, nonProduct.reasons.join('; '));

const unknownStatus = productScopeGate(contractFixture({ status: 'unknown' }));
check('unknown policy status is blocked', !unknownStatus.canProceedToCompanyMapping);


// ---------------------------------------------------------------------------
// T-6 additions: missing-information detector on the real AP contract.
// ---------------------------------------------------------------------------
import { detectGaps } from '../../src/schema/v2.js';
const apGaps = detectGaps(newContract, articleText);
check('AP contract: trade-code gap detected (high)', apGaps.some((g) => g.fieldPath === 'affectedTradeCodes' && g.importance === 'high'));
check('AP contract: exclusions gap detected', apGaps.some((g) => g.fieldPath === 'exclusions'));
check('AP contract: no blocking gaps (products resolved)', !apGaps.some((g) => g.importance === 'blocking'), JSON.stringify(apGaps.filter((g) => g.importance === 'blocking').map((g) => g.fieldPath)));
const emptyScopeGaps = detectGaps(contractFixture({}), 'no retaliation mentioned here');
check('empty-scope fixture: blocking product gap emitted', emptyScopeGaps.some((g) => g.importance === 'blocking' && g.fieldPath === 'targetedProducts'));

// ---------------------------------------------------------------------------
console.log('');
console.log(`regression: ${failures} failure(s)`);
if (failures) process.exit(1);
