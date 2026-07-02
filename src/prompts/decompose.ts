export function decomposePrompt(seed: string): string {
  return `You are an equity analyst on a small-cap growth team. Decompose the seed thesis below into an adoption chain: the set of places in the economy where value shifts if the thesis plays out.

Seed thesis: ${seed}

Produce 6 to 10 chain nodes across exactly these four layers:
- "enabler": companies whose product must exist for the thesis to happen (components, materials, core technology).
- "picks_and_shovels": companies selling into the buildout regardless of which end vendor wins (test equipment, tooling, integration, infrastructure).
- "second_order": incumbents in other industries whose margins or volumes inflect if adoption happens. This is where existing companies improve from the new technology, not where new technology gets built.
- "disrupted": incumbents whose economics deteriorate. Include at least one; the bear side of the chain is part of the map.

Rules:
- Each node is a niche, not a company. Name no tickers.
- "logic" is 2 to 3 sentences of economic reasoning: who pays whom, what line item inflects, and why the effect is levered to the thesis rather than linear with it.
- "searchPhrases" are 2 to 3 exact phrases a company in that niche would plausibly write in its own 10-K or 10-Q. They go verbatim into SEC full-text search, so use filing language (product and market nouns), not analyst language. Two to four words each.
- "themeKeywords" are 5 to 10 single words or short phrases used to locate theme discussion inside a filing.
- Plain factual prose. No em-dashes, no exclamation points, no superlatives.

Return only a JSON object:
{
  "nodes": [
    { "id": "kebab-case-id", "layer": "enabler|picks_and_shovels|second_order|disrupted", "name": "...", "logic": "...", "searchPhrases": ["...", "..."] }
  ],
  "themeKeywords": ["...", "..."]
}`;
}
