import { fable } from '../lib/fable.js';
import { load, save, saveText } from '../lib/store.js';
import { draftPrompt } from '../prompts/draft.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { Candidate, Decomposition, Read, Thesis } from '../types.js';

export async function draftTheses(slug: string): Promise<Thesis[]> {
  const { seed } = load<{ seed: string }>(slug, 'run');
  const decomp = load<Decomposition>(slug, 'decompose');
  const candidates = load<Candidate[]>(slug, 'candidates');
  const reads = load<Read[]>(slug, 'reads');
  const scores = load<Record<string, number>>(slug, 'scores');

  const theses: Thesis[] = [];
  for (const read of reads) {
    const c = candidates.find((x) => x.ticker === read.ticker)!;
    const node = decomp.nodes.find((n) => n.id === c.nodeId)!;
    const markdown = await fable(
      slug,
      `thesis-${read.ticker}`,
      draftPrompt({
        seed,
        node,
        ticker: read.ticker,
        companyName: c.name,
        publicFloatMM: c.publicFloatMM,
        read,
        score: scores[read.ticker],
        rubric,
      }),
      'markdown',
    );
    theses.push({ ticker: read.ticker, score: scores[read.ticker], markdown });
    saveText(slug, `theses/${read.ticker}.md`, markdown);
    console.log(`[draft] ${read.ticker}: thesis drafted (${markdown.split(/\s+/).length} words)`);
  }

  theses.sort((a, b) => b.score - a.score);
  save(slug, 'theses', theses);
  return theses;
}
