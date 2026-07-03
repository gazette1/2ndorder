import { TAG_VOCABULARY } from './card.js';
import type { Sections } from './sections.js';

export function cardPrompt(args: { ticker: string; name: string; sections: Sections }): string {
  return `You are an equity analyst building a structured card for ${args.name} (${args.ticker}) from its own 10-K. Read the sections below and extract only what the filing supports.

=== BUSINESS (Item 1) ===
${args.sections.business || '(section not found)'}

=== RISK FACTORS (Item 1A, excerpt) ===
${args.sections.riskFactors || '(section not found)'}

=== MD&A (Item 7) ===
${args.sections.mdna || '(section not found)'}

Extract:
- "business": what the company sells and to whom, 2 to 3 plain factual sentences.
- "sellsTo": end markets and customer types (short phrases).
- "namedCustomers", "namedSuppliers": only names the filing states.
- "exposures": every technology or theme the filing shows exposure to. "tag" MUST come from this vocabulary: ${TAG_VOCABULARY.join(', ')}. If a real exposure fits no tag, use "other:<short-term>". "stance" is "core_product" (they sell it), "active_investment" (they are building it, named program or committed spend), or "risk_mention" (risk factors or trend name-dropping only). "sentence" is the EXACT sentence from the filing that supports the exposure, copied verbatim.
- "catalysts": dated or datable events the filing commits to (capacity additions, qualifications, launches, contract milestones), each with its exact sentence.
- "tamClaims": quantified market size claims the filing itself makes, each with its exact sentence.

Rules:
- Every exposure, catalyst, and TAM claim carries its exact filing sentence. No sentence, no entry.
- Do not use outside knowledge of the company.
- Plain factual prose. No em-dashes, no exclamation points, no superlatives.

Return only a JSON object:
{
  "business": "...",
  "sellsTo": ["..."],
  "namedCustomers": [],
  "namedSuppliers": [],
  "exposures": [{ "tag": "...", "stance": "core_product", "sentence": "..." }],
  "catalysts": [{ "event": "...", "date": "YYYY-MM-DD or null", "sentence": "..." }],
  "tamClaims": [{ "claim": "...", "sentence": "..." }]
}`;
}
