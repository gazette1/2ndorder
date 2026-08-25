// Evidence-bound trigger extraction for article runs (Day 1 of the V2 sprint).
// The article text is the only permitted source; every number must appear in
// it verbatim, and the deterministic validator halts the pipeline on any
// invented figure. This replaces trusting the model's free-form summary.
import { llm } from '../lib/llm.js';
import { save, saveText } from '../lib/store.js';
import type { TriggerContract } from '../types.js';

export function triggerContractPrompt(url: string, title: string, text: string): string {
  return `Extract the trigger event from this news article into the exact JSON schema below.

HARD RULES:
- Use ONLY facts stated in the article text. Every number, rate, date, and legal citation must appear in the article.
- For each field with an exactQuote, copy the sentence fragment from the article VERBATIM (up to 200 characters).
- confidence is "verified" when the quote states the value directly, "inferred" when you derived it from stated facts, "unknown" when absent.
- If a value is not in the article, set it null with confidence "unknown". NEVER estimate, NEVER use ranges the article does not state.
- Distinguish the ORIGINAL action from any RETALIATORY response; the response goes in "response", never blended into the primary fields.
- Distinguish publication date, event date, and effective date. null any the article does not state.
- status: "effective" only if the article says the action took effect; "announced" if declared but not yet in force; "proposed" if only threatened or under consideration.
- "unsupportedClaims": list any claim you were tempted to include but could not support with article text. Empty array if none.
- Plain factual prose. No em-dashes, no exclamation points.

Article URL: ${url}
Article title: ${title}
Article text:
${text}

Return only a JSON object:
{
  "sourceUrl": "${url}",
  "publicationDate": null,
  "eventDate": null,
  "effectiveDate": null,
  "primaryActor": "...",
  "action": "...",
  "counterparty": null,
  "legalAuthority": { "value": null, "exactQuote": null, "confidence": "unknown" },
  "rates": { "value": ["50%"], "exactQuote": "...", "confidence": "verified" },
  "monetaryScope": { "value": [{ "value": 20, "currency": "USD", "unit": "billion" }], "exactQuote": "...", "confidence": "verified" },
  "targetedProducts": { "value": ["..."], "exactQuote": "...", "confidence": "verified" },
  "response": { "actor": "...", "action": "...", "announcedDate": null, "effectiveDate": null, "exactQuote": "..." },
  "status": "effective",
  "reversibilityMechanisms": ["..."],
  "unsupportedClaims": []
}`;
}

// Normalize for containment checks: whitespace, quote marks, case, and
// dash/comma variance. The variance matters because the pipeline's own
// house-style pass (deSlop) rewrites em-dashes to commas in model output, so
// a verbatim quote of "U.S. — or $20 billion" arrives as "U.S., or $20
// billion"; the validator must not fail honest quotes over that rewrite.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[—–,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TriggerValidation {
  ok: boolean;
  problems: string[];
}

// Deterministic validation: numbers and quotes must exist in the article.
export function validateTriggerContract(tc: TriggerContract, articleText: string): TriggerValidation {
  const problems: string[] = [];
  const hay = norm(articleText);

  const quoteInText = (q: string | null, label: string) => {
    if (!q) return;
    if (!hay.includes(norm(q).slice(0, 120))) problems.push(`${label}: exactQuote not found in article text`);
  };

  const numberInText = (n: string | number, label: string) => {
    const s = String(n);
    if (!hay.includes(norm(s))) problems.push(`${label}: value "${s}" does not appear in the article`);
  };

  for (const r of tc.rates?.value ?? []) numberInText(r, 'rates');
  quoteInText(tc.rates?.exactQuote ?? null, 'rates');

  for (const m of tc.monetaryScope?.value ?? []) {
    numberInText(m.value, 'monetaryScope');
    if (!m.currency) problems.push('monetaryScope: currency missing');
  }
  quoteInText(tc.monetaryScope?.exactQuote ?? null, 'monetaryScope');
  quoteInText(tc.legalAuthority?.exactQuote ?? null, 'legalAuthority');
  quoteInText(tc.targetedProducts?.exactQuote ?? null, 'targetedProducts');
  if (tc.response) quoteInText(tc.response.exactQuote, 'response');

  const okStatus = ['announced', 'effective', 'suspended', 'expired', 'proposed', 'unknown'];
  if (!okStatus.includes(tc.status)) problems.push(`status "${tc.status}" is not a valid state`);
  if (!tc.primaryActor || !tc.action) problems.push('primaryActor and action are required');

  // Invented-range tripwire: a rate with confidence "verified" must literally
  // appear; ranges like "10 to 25" that are absent from the text die here via
  // numberInText. Additionally, any rate marked inferred is a hard stop:
  // magnitudes are facts, not inferences.
  if (tc.rates?.confidence === 'inferred') problems.push('rates marked inferred; magnitudes must be verified or absent');
  if (tc.monetaryScope?.confidence === 'inferred') problems.push('monetaryScope marked inferred; amounts must be verified or absent');

  return { ok: problems.length === 0, problems };
}

export async function extractTriggerContract(
  slug: string,
  article: { url: string; title: string; text: string },
): Promise<TriggerContract> {
  // The exact text the model saw always sits next to the contract it produced.
  saveText(slug, 'article.txt', article.text);
  const raw = await llm(slug, 'trigger-contract', triggerContractPrompt(article.url, article.title, article.text), 'json', 'heavy');
  const tc = JSON.parse(raw) as TriggerContract;
  tc.sourceUrl = article.url;
  const v = validateTriggerContract(tc, article.text);
  save(slug, 'trigger-contract', { ...tc, validation: v });
  if (!v.ok) {
    throw new Error(
      `Trigger validation failed. Review the unsupported claims before continuing: ${v.problems.join('; ')}`,
    );
  }
  return tc;
}
