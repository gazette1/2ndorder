import type { ChainNode, Read, Rubric } from '../types.js';

export function draftPrompt(args: {
  seed: string;
  node: ChainNode;
  ticker: string;
  companyName: string;
  publicFloatMM: number | null;
  read: Read;
  score: number;
  rubric: Rubric;
}): string {
  const quotes = args.read.quotes
    .map((q, i) => `[${i}] (${q.form}, filed ${q.filedAt}, ${q.url}) ${q.text}`)
    .join('\n');
  const subs = Object.entries(args.read.subscores)
    .map(([k, s]) => `- ${k}: ${s.score}/5 (weight ${(args.rubric.weights as any)[k]}). ${s.rationale}`)
    .join('\n');

  return `Draft a one-page thesis for ${args.companyName} (${args.ticker}) in the house format below. You are drafting for an analyst who will tear it apart, not for a client.

Seed thesis: ${args.seed}
Chain position: ${args.node.name} (${args.node.layer}). ${args.node.logic}
Public float: ${args.publicFloatMM === null ? 'not reported' : `$${args.publicFloatMM}MM`}
Composite score: ${args.score}/100
Subscores:
${subs}

Filing evidence (the only permitted factual sources; cite as [n]):
${quotes}

House format, exactly these sections in this order:
# {TICKER}: {one-line thesis}
## Bear case first
Why this name fails. The strongest disconfirming reading of the same evidence, plus what the filings do not show. 3 to 5 sentences.
## Business today
What the company sells and to whom, from the evidence only. 2 to 3 sentences.
## Chain position
Which node of the adoption chain it occupies and the economic logic. 2 to 3 sentences.
## Non-linear case
The path where the outcome is a multiple of today's business, and what has to be true. 3 to 5 sentences.
## Filing evidence
Each claim above that rests on a filing, restated as a bullet: claim, then the citation [n]. Every [n] used above must appear here.
## What would change our mind
2 to 3 observable events, each tied to a filing type where it would show up.

Style rules, hard requirements:
- Every factual claim about the company carries a citation [n] to a filing excerpt. Claims without a supporting excerpt must be framed as open questions, not facts.
- No em-dashes, no exclamation points, no superlatives. Plain factual sentences.
- Dollar amounts: M for thousands, MM for millions.
- Do not pad. Under 500 words.

Return only the markdown document.`;
}
