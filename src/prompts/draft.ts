import type { ChainNode, Dossier, Read, Rubric } from '../types.js';

// Dollars formatted M for thousands, MM for millions, per house style.
function money(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}MM`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}M`;
  return `$${n}`;
}

function dossierFacts(d: Dossier | undefined): string {
  if (!d) return 'No dossier available.';
  const c = d.customers;
  const cov = d.coverage;
  const awards = c.govAwards.slice(0, 3).map((a) => `${a.agency} ${money(a.amountUSD)} (${a.awardId})`).join('; ');
  const actions = cov.ratingActions
    .slice(0, 3)
    .map((a) => `${a.firm} ${a.action} to ${a.toGrade}${a.priceTargetUSD ? ` PT $${a.priceTargetUSD}` : ''} (${a.date})`)
    .join('; ');
  return [
    `Insider (SEC Form 4, ${d.insider.window}): net open-market ${money(d.insider.netBuyUSD)} across ${d.insider.buyCount} buys and ${d.insider.sellCount} sales by ${d.insider.distinctBuyers} insider(s).`,
    `Fundamentals (SEC XBRL, as of ${d.fundamentals.asOf ?? 'n/a'}): revenue ${d.fundamentals.revenueUSD === null ? 'not reported' : money(d.fundamentals.revenueUSD)}, cash ${d.fundamentals.cashUSD === null ? 'n/a' : money(d.fundamentals.cashUSD)}.`,
    `Customer graph: federal awards ${money(c.govAwardTotalUSD)}${awards ? ` (${awards})` : ''}; named customers ${c.namedCustomers.join(', ') || 'none in excerpts'}; ${c.reverseCiteCount} other filers name the company.`,
    `Street view (sell-side aggregators, firm and grade only, reports paywalled): ${cov.analystCount ?? 'unknown'} analysts, consensus ${cov.consensusRating ?? 'n/a'}, mean target ${cov.priceTargetMeanUSD ? `$${cov.priceTargetMeanUSD}` : 'n/a'}${actions ? `; recent actions ${actions}` : ''}.`,
  ].join('\n');
}

export function draftPrompt(args: {
  seed: string;
  node: ChainNode;
  ticker: string;
  companyName: string;
  publicFloatMM: number | null;
  read: Read;
  dossier?: Dossier;
  score: number;
  rubric: Rubric;
}): string {
  const quotes = args.read.quotes
    .map((q, i) => `[${i}] (${q.form}, filed ${q.filedAt}, ${q.url}) ${q.text}`)
    .join('\n');
  const subs = Object.entries(args.read.subscores)
    .map(([k, s]) => `- ${k}: ${s!.score}/5 (weight ${(args.rubric.weights as any)[k]}). ${s!.rationale}`)
    .join('\n');

  return `Draft a one-page thesis for ${args.companyName} (${args.ticker}) in the house format below. You are drafting for an analyst who will tear it apart, not for a client.

Seed thesis: ${args.seed}
Map position: ${args.node.name} (order ${args.node.order}, ${args.node.polarity}, horizon ${args.node.horizon}). Mechanism: ${args.node.mechanism} ${args.node.logic}
Public float: ${args.publicFloatMM === null ? 'not reported' : `$${args.publicFloatMM}MM`}
Composite score: ${args.score}/100
Subscores:
${subs}

Filing evidence (the only permitted source for filing claims; cite as [n]):
${quotes}

Dossier facts (from SEC Form 4, SEC XBRL, and USASpending; cite these as (source) in prose, for example "(Form 4)" or "(USASpending)"):
${dossierFacts(args.dossier)}

House format, exactly these sections in this order:
# {TICKER}: {one-line thesis}
## Bear case first
Why this name fails. The strongest disconfirming reading of the same evidence, plus what the filings do not show. Include the disconfirming read of the dossier: insider selling, customer concentration risk, or thin customer evidence. 3 to 5 sentences.
## Business today
What the company sells and to whom, from the evidence only. State revenue and cash from the dossier when available. 2 to 3 sentences.
## Chain position
Which node of the adoption chain it occupies and the economic logic. 2 to 3 sentences.
## Customer graph
Who actually pays the company: named enterprise customers, federal award dollars and agencies, and how many other filers name it. Label each buyer enterprise, government, or unproven. If customer evidence is thin, say so plainly. 2 to 4 sentences.
## Insider and management signal
Open-market insider buying or selling over the trailing 12 months (Form 4), read as conviction, alongside management language from the filings. 2 to 3 sentences.
## Street view
What sell-side coverage exists and how thin it is: analyst count, consensus, mean target, and any recent firm rating actions. State the firm and grade only; the bank reports are paywalled and not linked. For an under-covered small-cap, thin coverage is itself part of the setup. 2 to 3 sentences.
## Non-linear case
The path where the outcome is a multiple of today's business, and what has to be true. 3 to 5 sentences.
## Evidence
Each filing claim restated as a bullet with its citation [n]. Every [n] used above must appear here. Dossier facts are cited inline by source, not by [n].
## What would change our mind
2 to 3 observable events, each tied to where it would show up: a filing type, a Form 4, or a federal award.

Style rules, hard requirements:
- Every factual claim from a filing carries a citation [n]. Dossier claims carry a source tag in parentheses. Claims without support are framed as open questions, not facts.
- No em-dashes, no exclamation points, no superlatives. Plain factual sentences.
- Dollar amounts: M for thousands, MM for millions.
- Do not pad. Under 600 words.

Return only the markdown document.`;
}
