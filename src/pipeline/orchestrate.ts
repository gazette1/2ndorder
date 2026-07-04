import { counterScenario, decompose } from './decompose.js';
import { draftTheses } from './draft.js';
import { enrich } from './enrich.js';
import { mapTickers } from './map.js';
import { readFilings } from './read.js';
import { score } from './score.js';
import { load, save } from '../lib/store.js';
import { macroContext } from '../lib/macro.js';
import { fetchArticleText } from '../lib/article.js';
import { llm } from '../lib/llm.js';
import { articleScenarioPrompt } from '../prompts/decompose.js';

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
