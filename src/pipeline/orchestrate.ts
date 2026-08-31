import { counterScenario, decompose } from './decompose.js';
import { draftTheses } from './draft.js';
import { enrich } from './enrich.js';
import { mapTickers } from './map.js';
import { readFilings } from './read.js';
import { score } from './score.js';
import { load, save, saveText } from '../lib/store.js';
import { macroContext } from '../lib/macro.js';
import { fetchArticleText } from '../lib/article.js';
import { llm } from '../lib/llm.js';
import { articleScenarioPrompt } from '../prompts/decompose.js';
import { extractTriggerContract } from './trigger.js';
import { addEvidence, detectGaps, productScopeGate } from '../schema/v2.js';
import { extractRetaliation, mapSectors, researchPass } from './research.js';

// The full pipeline for one run, in order. Used by the CLI "all" stage and by the
// API server when a search has no cached run. Each stage persists its output to
// data/runs/<slug>, so a failure can be resumed from the last completed stage.
export async function runAll(slug: string, seed: string): Promise<void> {
  await decompose(slug, seed);
  // Macro context (FRED, keyless): which published series bear on the scenario.
  // Fails soft; a run without macro context is still a run.
  try {
    const macro = await macroContext(slug, seed);
    if (macro) save(slug, 'macro', macro);
  } catch {
    // keyless endpoint hiccup; skip
  }
  await mapTickers(slug);
  await enrich(slug);
  await readFilings(slug);
  await score(slug);
  await draftTheses(slug);
}

// Generate the disconfirming scenario and run it as a linked full run.
// Names that survive both maps are robust ideas; names that flip are trades on
// the scenario itself.
export async function runCounter(slug: string): Promise<string> {
  const counterSeed = await counterScenario(slug);
  const counterSlug = `${slug}-counter`;
  save(counterSlug, 'run', { seed: counterSeed, createdAt: new Date().toISOString(), counterOf: slug });
  console.log(`[counter] "${counterSeed}" -> run ${counterSlug}`);
  await runAll(counterSlug, counterSeed);
  return counterSlug;
}

// A pasted news link: fetch the article, extract the investable scenario, run
// it fully, then run the disconfirming case, so the user gets both the bull
// and the bear read of the same headline.
export async function runFromArticle(slug: string, url: string): Promise<void> {
  const article = await fetchArticleText(url);
  console.log(`[article] fetched "${article.title.slice(0, 80)}" (${article.text.length} chars)`);
  // Persist the article text: the trigger validator and any later audit need
  // the exact source the model saw.
  saveText(slug, 'article.txt', article.text);

  // Evidence-bound trigger contract FIRST. If validation fails (an invented
  // number, a quote not in the text), this throws and the run stops here;
  // an unvalidated event never reaches decomposition.
  const contract = await extractTriggerContract(slug, article);
  console.log(
    `[trigger] validated: ${contract.primaryActor} ${contract.action.slice(0, 60)} | rates ${(contract.rates.value ?? []).join(', ') || 'none stated'} | status ${contract.status}`,
  );

  // INV-004 product-scope gate: for product-specific policy (tariffs,
  // sanctions, subsidies, procurement), company mapping cannot start while
  // the product scope is empty. A blocked run publishes a research-status
  // card instead of tickers.
  // Evidence record for the source article (schema v2: evidence-index.json).
  addEvidence(slug, {
    kind: 'major_news',
    title: article.title,
    publisher: new URL(article.url).hostname,
    url: article.url,
    retrievedAt: new Date().toISOString(),
    excerpt: article.text.slice(0, 300),
    authorityRank: 9,
    supports: ['trigger-contract'],
  });

  // Missing-information detector: deterministic gaps persisted for the
  // research planner and the research-status card.
  const gaps = detectGaps(contract, article.text);
  save(slug, 'gaps', gaps);
  const blocking = gaps.filter((g) => g.importance === 'blocking');
  console.log(`[gaps] ${gaps.length} open (${blocking.length} blocking, ${gaps.filter((g) => g.importance === 'high').length} high)`);

  const gate = productScopeGate(contract);
  save(slug, 'research-status', {
    eventType: gate.eventType,
    canProceedToCompanyMapping: gate.canProceedToCompanyMapping,
    reasons: gate.reasons,
    warnings: gate.warnings,
    openGaps: gaps.filter((g) => g.status === 'open').length,
    blockingGaps: blocking.map((g) => g.question),
    at: new Date().toISOString(),
  });
  if (!gate.canProceedToCompanyMapping) {
    throw new Error(
      `Research incomplete; company mapping blocked. ${gate.reasons.join(' ')} ` +
        'Resolve the scope (official annex, product list, or trade codes) and rerun.',
    );
  }
  for (const w of gate.warnings) console.warn(`[gate] ${w}`);

  // T-5 research pass: bounded follow-up research through the configured
  // provider (fixture, direct URLs, or an honest unavailable state), the
  // researched trigger with its inspectable diff, and retaliation extracted
  // as its own event with status groups never blended.
  const { researched } = await researchPass(slug, contract, load(slug, 'gaps'), article.text);
  const retaliation = await extractRetaliation(slug, article.text);
  await mapSectors(slug, researched, retaliation);

  const raw = await llm(slug, 'article-scenario', articleScenarioPrompt(article.title, article.text), 'json', 'heavy');
  const scenario = String((JSON.parse(raw) as { scenario: string }).scenario ?? '').trim();
  if (!scenario) throw new Error('Could not extract an investable scenario from the article.');
  console.log(`[article] scenario: "${scenario}"`);

  const existing = (() => {
    try {
      return load<Record<string, unknown>>(slug, 'run');
    } catch {
      return {};
    }
  })();
  save(slug, 'run', { ...existing, seed: scenario, sourceUrl: article.url, sourceTitle: article.title });

  await runAll(slug, scenario);
  await runCounter(slug);
}
