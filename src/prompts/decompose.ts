const PHRASE_RULES = `- "searchPhrases" are 3 to 4 phrases a company in that niche would plausibly write in its own 10-K or 10-Q. They go verbatim into SEC full-text search, so use filing language (product and market nouns), not analyst language.
- Balance specificity against recall. The search is EXACT-PHRASE against filing text, so each phrase must be common enough to appear verbatim in real filings AND on-theme enough to surface relevant companies. Use short, common filing terms, 1 to 3 words: for a humanoid robotics scenario, "rare earth magnets", "harmonic drive", "warehouse automation", and "machine vision" work because companies actually write them. Avoid two traps: category words so broad they match unrelated industries ("energy storage systems" pulls grid batteries), and over-specific compounds that never appear verbatim ("harmonic drive gear module" returns nothing). When unsure, prefer the shorter, more common wording. The filing-read stage filters off-theme names, so favor recall over precision here.`;

const NODE_RULES = `- Each node is a niche, not a company. Name no tickers.
- "polarity" is "beneficiary" (economics improve) or "at_risk" (economics deteriorate). The bear side is part of the map: include at_risk nodes wherever the scenario genuinely harms someone, not as decoration.
- "mechanism" is ONE line of causal logic: who pays whom, or which line item moves, and why.
- "logic" is 2 to 3 sentences expanding the mechanism: why the effect is levered to the scenario rather than linear with it.
- "horizon" is when the consequence becomes observable in company results: "near" (0 to 6 months), "mid" (6 to 18 months), "long" (18 months plus).
- Plain factual prose. No em-dashes, no exclamation points, no superlatives.`;

export function decomposePrompt(seed: string): string {
  return `You are an equity analyst on a small-cap growth team. A portfolio manager gives you a scenario. Map its consequences as a tree: 1st order effects follow directly from the scenario, 2nd order effects follow from a 1st order effect, 3rd order effects follow from a 2nd order effect. Good and bad consequences both belong on the map.

Scenario: ${seed}

Produce 10 to 14 nodes: 3 to 5 at order 1, 4 to 6 at order 2, 2 to 4 at order 3. At least 3 nodes across the map must be "at_risk". Every order 2 and order 3 node names its parent: the consequence it follows from. Order 1 nodes have parentId null.

Rules:
${NODE_RULES}
${PHRASE_RULES}
- "themeKeywords" are 5 to 10 single words or short phrases used to locate scenario discussion inside a filing.

Return only a JSON object:
{
  "nodes": [
    { "id": "kebab-case-id", "parentId": null, "order": 1, "polarity": "beneficiary", "name": "...", "mechanism": "...", "logic": "...", "horizon": "near", "searchPhrases": ["...", "..."] }
  ],
  "themeKeywords": ["...", "..."]
}`;
}

// Recursive drill: decompose one node a level deeper, in the scenario's context.
export function drillPrompt(seed: string, node: { id: string; order: number; name: string; mechanism: string; logic: string }): string {
  return `You are an equity analyst on a small-cap growth team. A portfolio manager is drilling one node of a scenario consequence map a level deeper.

Scenario: ${seed}
Node being drilled (order ${node.order}): ${node.name}
Its mechanism: ${node.mechanism}
Its logic: ${node.logic}

Produce 2 to 4 child nodes at order ${node.order + 1}: the consequences that follow from THIS node specifically, not from the scenario in general. Good and bad both belong. Each child has parentId "${node.id}" and order ${node.order + 1}.

Rules:
${NODE_RULES}
${PHRASE_RULES}

Return only a JSON object:
{
  "nodes": [
    { "id": "kebab-case-id", "parentId": "${node.id}", "order": ${node.order + 1}, "polarity": "beneficiary", "name": "...", "mechanism": "...", "logic": "...", "horizon": "mid", "searchPhrases": ["...", "..."] }
  ]
}`;
}

// Counter-scenario: the disconfirming case, stated as a scenario the pipeline can run.
export function counterPrompt(seed: string): string {
  return `A portfolio manager holds this scenario: "${seed}"

State the strongest disconfirming counter-scenario in ONE sentence, phrased the same way (a concrete outcome over a time window, not a negation). Example: for "humanoid robotics reaches commercial deployment 2027-2030" a counter-scenario is "humanoid robotics stalls at pilot programs through 2030 as unit economics stay above human labor cost". Plain factual prose, no em-dashes, no exclamation points.

Return only a JSON object: { "counterScenario": "..." }`;
}
