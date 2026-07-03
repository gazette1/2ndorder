import { llm } from '../lib/llm.js';
import { save } from '../lib/store.js';
import { decomposePrompt } from '../prompts/decompose.js';
import type { ChainNode, Decomposition, Layer } from '../types.js';

const LAYERS: Layer[] = ['enabler', 'picks_and_shovels', 'second_order', 'disrupted'];

// Model output is an untrusted boundary, more so with smaller local models. Keep
// only well-formed nodes so one malformed entry does not sink the run downstream.
function validNode(n: any): n is ChainNode {
  return (
    n &&
    typeof n.name === 'string' &&
    LAYERS.includes(n.layer) &&
    Array.isArray(n.searchPhrases) &&
    n.searchPhrases.every((p: unknown) => typeof p === 'string')
  );
}

export async function decompose(slug: string, seed: string): Promise<Decomposition> {
  const raw = await llm(slug, 'decompose', decomposePrompt(seed), 'json');
  const parsed = JSON.parse(raw) as Decomposition;
  const nodes = (parsed.nodes ?? []).filter(validNode);
  const dropped = (parsed.nodes?.length ?? 0) - nodes.length;
  if (!nodes.length) throw new Error('Decomposition returned no well-formed chain nodes.');
  const result: Decomposition = { nodes, themeKeywords: Array.isArray(parsed.themeKeywords) ? parsed.themeKeywords : [] };
  save(slug, 'run', { seed, createdAt: new Date().toISOString() });
  save(slug, 'decompose', result);
  console.log(`[decompose] ${nodes.length} chain nodes${dropped ? ` (dropped ${dropped} malformed)` : ''}`);
  return result;
}
