// T-5 research pass (master prompt sections 10-12, 15): plan bounded queries
// from the open gaps, execute them through the configured provider, merge
// authoritative findings into a researched trigger contract with a
// deterministic diff, and extract retaliation as its own event with status
// groups that are never blended.
import { llm } from '../lib/llm.js';
import { save } from '../lib/store.js';
import { addEvidence, findUnsupportedNumbers } from '../schema/v2.js';
import { researchMode, runQuery, type ResearchQuery } from '../research/provider.js';
import type { RetaliationAction, ResearchDoc, SourceGap, TriggerContract, TriggerDiffEntry } from '../types.js';

// ---------------------------------------------------------------------------
// Query planning (12.3): targeted forms, never broad "tariff winners" mush.
// ---------------------------------------------------------------------------
export function planQueries(contract: TriggerContract, gaps: SourceGap[]): ResearchQuery[] {
  const queries: ResearchQuery[] = [];
  let n = 0;
  const q = (query: string, fixtureName: string) =>
    queries.push({ queryId: `rq-${String(++n).padStart(2, '0')}`, query, fixtureName });

  for (const g of gaps.filter((x) => x.status === 'open' && (x.importance === 'blocking' || x.importance === 'high'))) {
    if (g.fieldPath === 'targetedProducts' || g.fieldPath === 'affectedTradeCodes') {
      q(`${contract.action} official product list annex HTSUS codes`, 'official-product-list');
    } else if (g.fieldPath === 'exclusions') {
      q(`${contract.action} exclusions exemptions official notice`, 'exclusions');
    } else if (g.fieldPath === 'response') {
      q(`${contract.counterparty ?? 'counterparty'} retaliatory measures official product list`, 'retaliation-official');
    } else if (g.fieldPath === 'effectiveDate') {
      q(`${contract.action} effective date federal register`, 'effective-date');
    }
  }
  // Bounded budget (10.3): cap total queries.
  return queries.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Merge: light-model extraction from researched docs, then deterministic
// validation that every changed number appears in some evidence text.
// ---------------------------------------------------------------------------
function mergePrompt(contract: TriggerContract, docs: ResearchDoc[]): string {
  const docsText = docs
    .map((d, i) => `DOC ${i + 1} (${d.mode}${d.url ? ', ' + d.url : ''}): ${d.title}\n${d.text.slice(0, 5000)}`)
    .join('\n\n');
  return `A validated source-only trigger contract and additional researched documents follow. Produce the RESEARCHED contract: same JSON schema, updating ONLY fields the documents support with explicit facts (rates, dates, product lists, trade codes, exclusions, legal authority, monetary scope). Rules:
- Never change a value the documents do not address; copy it unchanged.
- Never invent numbers; every new or changed number must appear in a document.
- For each changed field keep exactQuote from the supporting document, verbatim.
- Confidence stays "verified" only for direct statements.
- Plain factual prose. No em-dashes, no exclamation points.

SOURCE-ONLY CONTRACT:
${JSON.stringify(contract)}

RESEARCHED DOCUMENTS:
${docsText}

Return only the full contract JSON object.`;
}

function diffContracts(before: TriggerContract, after: TriggerContract): TriggerDiffEntry[] {
  const fields: Array<keyof TriggerContract> = [
    'publicationDate', 'eventDate', 'effectiveDate', 'primaryActor', 'action', 'counterparty',
    'legalAuthority', 'rates', 'monetaryScope', 'targetedProducts', 'response', 'status', 'reversibilityMechanisms',
  ];
  return fields.map((f) => {
    const b = JSON.stringify(before[f] ?? null);
    const a = JSON.stringify(after[f] ?? null);
    const change: TriggerDiffEntry['change'] =
      b === a ? 'unchanged' : b === 'null' || b === '[]' ? 'added' : 'changed';
    return { fieldPath: String(f), change, before: JSON.parse(b), after: JSON.parse(a), evidenceIds: [] };
  });
}

export async function researchPass(
  slug: string,
  contract: TriggerContract,
  gaps: SourceGap[],
  articleText: string,
): Promise<{ researched: TriggerContract; docs: ResearchDoc[] }> {
  const mode = researchMode();
  save(slug, 'trigger-source-only', contract);

  const plan = planQueries(contract, gaps);
  save(slug, 'research-plan', { mode, queries: plan });

  const docs: ResearchDoc[] = [];
  for (const q of plan) {
    for (const d of await runQuery(q, mode)) {
      if (d.mode !== 'unavailable' && d.text.length > 200) {
        const ev = addEvidence(slug, {
          kind: d.mode === 'fixture' ? 'test_fixture' : 'official_policy',
          title: d.title,
          publisher: d.url ? new URL(d.url).hostname : 'fixture',
          url: d.url ?? undefined,
          retrievedAt: new Date().toISOString(),
          excerpt: d.text.slice(0, 300),
          authorityRank: d.mode === 'fixture' ? 10 : 2,
          supports: [q.queryId],
        });
        d.evidenceId = ev.evidenceId;
      }
      docs.push(d);
    }
  }

  const usable = docs.filter((d) => d.mode !== 'unavailable' && d.text.length > 200);
  let researched = contract;
  if (usable.length) {
    const raw = await llm(slug, 'trigger-researched', mergePrompt(contract, usable), 'json', 'heavy');
    const merged = JSON.parse(raw) as TriggerContract;
    merged.sourceUrl = contract.sourceUrl;
    // Deterministic guard: every number in the researched contract must
    // appear in the article or one of the researched documents.
    const corpus = [articleText, ...usable.map((d) => d.text)].join('\n');
    const claimText = JSON.stringify([merged.rates, merged.monetaryScope, merged.targetedProducts]);
    const bad = findUnsupportedNumbers(claimText, corpus);
    if (bad.length) {
      throw new Error(`Researched trigger introduced unsupported numbers: ${bad.map((b) => b.token).join(', ')}`);
    }
    researched = merged;
  }
  save(slug, 'trigger-researched', researched);
  save(slug, 'trigger-diff', diffContracts(contract, researched));
  console.log(
    `[research] mode=${mode} queries=${plan.length} docs=${docs.length} usable=${usable.length} diff=${diffContracts(contract, researched).filter((d) => d.change !== 'unchanged').length} changed fields`,
  );
  return { researched, docs };
}

// ---------------------------------------------------------------------------
// Retaliation engine (15): extract ALL counter-actions from the article into
// status groups; quotes for official and threatened actions must be verbatim.
// ---------------------------------------------------------------------------
function retaliationPrompt(articleText: string): string {
  return `Extract every retaliatory or counter action mentioned in this article into three STRICTLY separated groups:
- "official": actions announced or scheduled by an authority (with dates when stated).
- "threatened": actions explicitly threatened or signaled by a named actor but not enacted.
- "modeled": plausible next actions YOU infer from the stated positions. Mark every one probabilityBand "not_scored" unless the article itself supports a likelihood.
Rules:
- Every official or threatened action carries exactQuote copied verbatim from the article (up to 200 chars).
- targetedProducts only when the article names them.
- transmissionChannels: 1-3 short phrases for how the action reaches company economics (input cost, export demand, energy supply...).
- Do not blend groups. Do not invent dates. Plain factual prose, no em-dashes, no exclamation points.

Article text:
${articleText}

Return only JSON: { "actions": [ { "actor": "...", "action": "...", "group": "official", "announcedDate": null, "effectiveDate": null, "targetedProducts": [], "exactQuote": "...", "probabilityBand": "not_scored", "transmissionChannels": ["..."] } ] }`;
}

// ---------------------------------------------------------------------------
// Sector transmission (13.3): products to sectors with mechanism, direction,
// and timing, both polarities required, validated structurally.
// ---------------------------------------------------------------------------
export interface SectorImpact {
  sectorName: string;
  direction: 'beneficiary' | 'at_risk' | 'mixed';
  mechanism: string;
  affectedProducts: string[];
  channel:
    | 'direct_importer_exporter'
    | 'domestic_substitute'
    | 'upstream_input'
    | 'downstream_buyer'
    | 'distribution_logistics'
    | 'capacity_equipment'
    | 'demand_destruction'
    | 'retaliation_exposure';
  timeToImpact: 'immediate' | '0_3_months' | '3_12_months' | '12_plus_months';
  confidence: 'high' | 'medium' | 'low';
}

function sectorPrompt(contract: TriggerContract, retaliation: RetaliationAction[]): string {
  return `Map the sector-level transmission of this trade action. For each affected sector give: sectorName, direction (beneficiary, at_risk, mixed), mechanism (ONE challengeable sentence: who pays whom or which line item moves and why), affectedProducts (subset of the stated products), channel (one of: direct_importer_exporter, domestic_substitute, upstream_input, downstream_buyer, distribution_logistics, capacity_equipment, demand_destruction, retaliation_exposure), timeToImpact, confidence.
Rules:
- 6 to 12 sectors. BOTH directions must appear.
- Only products stated in the contract or retaliation actions; do not introduce new product categories.
- Retaliation-driven sectors use channel retaliation_exposure and reference the retaliation products.
- Plain factual prose. No em-dashes, no exclamation points, no company names.

TRIGGER CONTRACT: ${JSON.stringify({ action: contract.action, rates: contract.rates.value, products: contract.targetedProducts.value, status: contract.status, counterparty: contract.counterparty })}
RETALIATION ACTIONS: ${JSON.stringify(retaliation.map((r) => ({ group: r.group, actor: r.actor, action: r.action, products: r.targetedProducts })))}

Return only JSON: { "sectors": [ ... ] }`;
}

export async function mapSectors(
  slug: string,
  contract: TriggerContract,
  retaliation: RetaliationAction[],
): Promise<SectorImpact[]> {
  const raw = await llm(slug, 'sectors', sectorPrompt(contract, retaliation), 'json', 'heavy');
  const parsed = JSON.parse(raw) as { sectors?: SectorImpact[] };
  const CHANNELS = new Set([
    'direct_importer_exporter', 'domestic_substitute', 'upstream_input', 'downstream_buyer',
    'distribution_logistics', 'capacity_equipment', 'demand_destruction', 'retaliation_exposure',
  ]);
  const sectors = (parsed.sectors ?? []).filter(
    (s) =>
      s.sectorName &&
      ['beneficiary', 'at_risk', 'mixed'].includes(s.direction) &&
      s.mechanism &&
      CHANNELS.has(s.channel),
  );
  if (!sectors.some((s) => s.direction === 'beneficiary') || !sectors.some((s) => s.direction === 'at_risk')) {
    throw new Error('Sector map must contain both polarities (INV-005).');
  }
  save(slug, 'sectors', sectors);
  console.log(`[sectors] ${sectors.length} mapped (${sectors.filter((s) => s.direction === 'at_risk').length} at risk)`);
  return sectors;
}

function normQuote(s: string): string {
  return s.toLowerCase().replace(/[‘’“”]/g, "'").replace(/[—–,;:"]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function extractRetaliation(slug: string, articleText: string): Promise<RetaliationAction[]> {
  const raw = await llm(slug, 'retaliation', retaliationPrompt(articleText), 'json', 'light');
  const parsed = JSON.parse(raw) as { actions?: RetaliationAction[] };
  const hay = normQuote(articleText);
  const actions = (parsed.actions ?? []).filter((a) => {
    if (!a.actor || !a.action || !['official', 'threatened', 'modeled'].includes(a.group)) return false;
    if (a.group !== 'modeled') {
      // Official and threatened actions must be quote-backed by the article.
      if (!a.exactQuote) return false;
      if (!hay.includes(normQuote(a.exactQuote).slice(0, 100))) return false;
    }
    return true;
  });
  save(slug, 'retaliation', actions);
  const counts = { official: 0, threatened: 0, modeled: 0 } as Record<string, number>;
  for (const a of actions) counts[a.group]++;
  console.log(`[retaliation] official=${counts.official} threatened=${counts.threatened} modeled=${counts.modeled}`);
  return actions;
}
