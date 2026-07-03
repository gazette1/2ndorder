import { llm } from '../lib/llm.js';
import { save } from '../lib/store.js';
import { decomposePrompt } from '../prompts/decompose.js';
import type { Decomposition } from '../types.js';

export async function decompose(slug: string, seed: string): Promise<Decomposition> {
  const raw = await llm(slug, 'decompose', decomposePrompt(seed), 'json');
  const result = JSON.parse(raw) as Decomposition;
  if (!result.nodes?.length) throw new Error('Decomposition returned no chain nodes.');
  save(slug, 'run', { seed, createdAt: new Date().toISOString() });
  save(slug, 'decompose', result);
  console.log(`[decompose] ${result.nodes.length} chain nodes`);
  return result;
}
