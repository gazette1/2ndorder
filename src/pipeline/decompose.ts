import { CONFIG } from '../config.js';
import { llm } from '../lib/llm.js';
import { load, save } from '../lib/store.js';
import { counterPrompt, decomposePrompt, drillPrompt } from '../prompts/decompose.js';
import type { ChainNode, Decomposition } from '../types.js';

// Model output is an untrusted boundary, more so with smaller models. Keep only
// well-formed nodes so one malformed entry does not sink the run downstream.
function validNode(n: any): n is ChainNode {
  return (
    n &&
    typeof n.id === 'string' &&
    typeof n.name === 'string' &&
    typeof n.mechanism === 'string' &&
    typeof n.logic === 'string' &&
    (n.parentId === null || typeof n.parentId === 'string') &&
    typeof n.order === 'number' &&
    n.order >= 1 &&
    ['beneficiary', 'at_risk'].includes(n.polarity) &&
    ['near', 'mid', 'long'].includes(n.horizon) &&
    Array.isArray(n.searchPhrases) &&
    n.searchPhrases.length > 0 &&
    n.searchPhrases.every((p: unknown) => typeof p === 'string')
  );
}

// Orphaned parent links break the tree; reattach to the root rather than drop the node.
function repairTree(nodes: ChainNode[]): ChainNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) {
    if (n.parentId !== null && !ids.has(n.parentId)) {
      n.parentId = null;
    }
  }
  return nodes;
}

export async function decompose(slug: string, seed: string): Promise<Decomposition> {
  const raw = await llm(slug, 'decompose', decomposePrompt(seed), 'json', 'heavy');
  const parsed = JSON.parse(raw) as Decomposition;
  const nodes = repairTree((parsed.nodes ?? []).filter(validNode));
  const dropped = (parsed.nodes?.length ?? 0) - nodes.length;
  if (!nodes.length) throw new Error('Decomposition returned no well-formed nodes.');
  const result: Decomposition = { nodes, themeKeywords: Array.isArray(parsed.themeKeywords) ? parsed.themeKeywords : [] };
  // Merge over any existing run metadata (counterOf, asof) rather than clobbering it.
  let existing: Record<string, unknown> = {};
  try {
    existing = load<Record<string, unknown>>(slug, 'run');
  } catch {
    existing = {};
  }
  save(slug, 'run', {
    ...existing,
    seed,
    createdAt: (existing.createdAt as string) ?? new Date().toISOString(),
    asof: (existing.asof as string | null) ?? CONFIG.asof ?? null,
  });
  save(slug, 'decompose', result);
  const atRisk = nodes.filter((n) => n.polarity === 'at_risk').length;
  console.log(`[decompose] ${nodes.length} nodes (${atRisk} at_risk)${dropped ? ` (dropped ${dropped} malformed)` : ''}`);
  return result;
}

// Drill one node a level deeper: new child nodes append to the same run.
export async function drill(slug: string, nodeId: string): Promise<ChainNode[]> {
  const { seed } = load<{ seed: string }>(slug, 'run');
  const decomp = load<Decomposition>(slug, 'decompose');
  const node = decomp.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`No node "${nodeId}" in run "${slug}".`);

  const raw = await llm(slug, `drill-${nodeId}`, drillPrompt(seed, node), 'json', 'heavy');
  const parsed = JSON.parse(raw) as { nodes: ChainNode[] };
  const existing = new Set(decomp.nodes.map((n) => n.id));
  const children = (parsed.nodes ?? [])
    .filter(validNode)
    .filter((n) => !existing.has(n.id))
    .map((n) => ({ ...n, parentId: nodeId, order: node.order + 1 }));
  if (!children.length) throw new Error('Drill returned no well-formed child nodes.');

  decomp.nodes.push(...children);
  save(slug, 'decompose', decomp);
  console.log(`[drill] ${nodeId}: ${children.length} child nodes at order ${node.order + 1}`);
  return children;
}

// The disconfirming scenario, stated so the same pipeline can run it.
export async function counterScenario(slug: string): Promise<string> {
  const { seed } = load<{ seed: string }>(slug, 'run');
  const raw = await llm(slug, 'counter', counterPrompt(seed), 'json', 'heavy');
  const parsed = JSON.parse(raw) as { counterScenario: string };
  if (!parsed.counterScenario) throw new Error('Counter-scenario generation returned nothing.');
  return parsed.counterScenario;
}
