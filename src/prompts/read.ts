import type { ChainNode, Quote } from '../types.js';

export function readPrompt(args: {
  seed: string;
  node: ChainNode;
  ticker: string;
  companyName: string;
  eightKCount12m: number;
  rubricDefinitions: Record<string, string>;
  excerpts: Quote[];
}): string {
  const excerptBlock = args.excerpts
    .map((q, i) => `[${i}] (${q.form}, filed ${q.filedAt}) ${q.text}`)
    .join('\n');

  return `You are an equity analyst reading SEC filing excerpts for ${args.companyName} (${args.ticker}). The excerpts are exact sentences pulled from the company's own filings.

Seed thesis: ${args.seed}
Chain node this company was mapped to: ${args.node.name} (${args.node.layer}). Node logic: ${args.node.logic}
8-K filings in the last 12 months: ${args.eightKCount12m}

Excerpts:
${excerptBlock}

Score the company 0 to 5 on each dimension below. Definitions:
${Object.entries(args.rubricDefinitions).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

Rules:
- Every rationale must be supported by the excerpts. Cite supporting excerpts by index in "quoteIdx". If the excerpts do not support a judgment, score it low and say why. Do not use outside knowledge of the company for any factual claim.
- "exposure" is "direct" (the theme is the company's product or a named program), "adjacent" (sells into the theme's supply chain), or "peripheral" (mentions the theme without economic linkage).
- Plain factual prose. No em-dashes, no exclamation points, no superlatives.

Return only a JSON object:
{
  "exposure": "direct|adjacent|peripheral",
  "subscores": {
    "optionality": { "score": 0, "rationale": "...", "quoteIdx": [0] },
    "revenueToOpportunity": { "score": 0, "rationale": "...", "quoteIdx": [] },
    "catalystDensity": { "score": 0, "rationale": "...", "quoteIdx": [] },
    "managementConviction": { "score": 0, "rationale": "...", "quoteIdx": [] }
  }
}`;
}
