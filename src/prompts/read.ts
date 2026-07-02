import type { ChainNode, Dossier, Quote } from '../types.js';

function dossierBlock(d: Dossier | undefined): string {
  if (!d) return 'No dossier available.';
  const c = d.customers;
  const f = d.fundamentals;
  return [
    `Insider (Form 4, ${d.insider.window}): net open-market $${d.insider.netBuyUSD.toLocaleString()} across ${d.insider.buyCount} buys and ${d.insider.sellCount} sales by ${d.insider.distinctBuyers} insider(s).`,
    `Fundamentals (XBRL, as of ${f.asOf ?? 'n/a'}): revenue $${f.revenueUSD?.toLocaleString() ?? 'n/a'}, net income $${f.netIncomeUSD?.toLocaleString() ?? 'n/a'}, R&D $${f.rdExpenseUSD?.toLocaleString() ?? 'n/a'}, cash $${f.cashUSD?.toLocaleString() ?? 'n/a'}.`,
    `Customer graph: federal awards $${c.govAwardTotalUSD.toLocaleString()} across ${c.govAwards.length} awards${c.govAwards.length ? ` (top agency ${c.govAwards[0].agency})` : ''}; ${c.reverseCiteCount} other filers name the company.`,
  ].join('\n');
}

export function readPrompt(args: {
  seed: string;
  node: ChainNode;
  ticker: string;
  companyName: string;
  eightKCount12m: number;
  rubricDefinitions: Record<string, string>;
  excerpts: Quote[];
  dossier?: Dossier;
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

Dossier (context from other sources, already scored deterministically elsewhere; use it to inform judgment but cite only the excerpts above for factual claims):
${dossierBlock(args.dossier)}

Score the company 0 to 5 on each of these four dimensions:
${['optionality', 'revenueToOpportunity', 'catalystDensity', 'managementConviction'].map((k) => `- ${k}: ${args.rubricDefinitions[k]}`).join('\n')}
(insiderConviction and customerValidation are computed from the dossier, not by you.)

Rules:
- Every rationale must be supported by the excerpts. Cite supporting excerpts by index in "quoteIdx". If the excerpts do not support a judgment, score it low and say why. Do not use outside knowledge of the company for any factual claim.
- "exposure" is "direct" (the theme is the company's product or a named program), "adjacent" (sells into the theme's supply chain), or "peripheral" (mentions the theme without economic linkage).
- "namedCustomers": names of enterprise or government customers stated in the excerpts, if any. Empty array if none are named. Names only, from the excerpts.
- Plain factual prose. No em-dashes, no exclamation points, no superlatives.

Return only a JSON object:
{
  "exposure": "direct|adjacent|peripheral",
  "namedCustomers": [],
  "subscores": {
    "optionality": { "score": 0, "rationale": "...", "quoteIdx": [0] },
    "revenueToOpportunity": { "score": 0, "rationale": "...", "quoteIdx": [] },
    "catalystDensity": { "score": 0, "rationale": "...", "quoteIdx": [] },
    "managementConviction": { "score": 0, "rationale": "...", "quoteIdx": [] }
  }
}`;
}
