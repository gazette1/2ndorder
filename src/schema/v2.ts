// Schema v2 foundation (master prompt sections 8-12, INV-004, INV-012).
// Deterministic validators, no runtime dependencies; see
// reports/implementation-decisions.md entry 1.
import type { TriggerContract } from '../types.js';

// INV-012: policy status precision. The v1 contract's looser statuses map in.
export const POLICY_STATUSES = [
  'effective',
  'enacted_not_effective',
  'officially_announced',
  'explicitly_threatened',
  'modeled_probable',
  'hypothetical',
  'rescinded',
  'expired',
  'enjoined_or_blocked',
  'unknown',
] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const EVENT_TYPES = [
  'tariff',
  'sanction',
  'subsidy',
  'regulation',
  'procurement',
  'tax',
  'monetary_policy',
  'industrial_policy',
  'supply_disruption',
  'demand_shock',
  'technology_shift',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Event types where "on what products" is a blocking question (INV-004).
const PRODUCT_SPECIFIC: EventType[] = ['tariff', 'sanction', 'subsidy', 'procurement'];

// Deterministic fallback classifier so the gate never depends on a model
// having filled the field.
export function classifyEventType(contract: Pick<TriggerContract, 'action' | 'legalAuthority'>): EventType {
  const hay = `${contract.action} ${contract.legalAuthority?.value ?? ''}`.toLowerCase();
  if (/tariff|duty|duties|levy|levies|customs/.test(hay)) return 'tariff';
  if (/sanction|embargo|export control/.test(hay)) return 'sanction';
  if (/subsid|grant program|tax credit/.test(hay)) return 'subsidy';
  if (/procure|contract award|acquisition program/.test(hay)) return 'procurement';
  if (/regulat|rule|standard|mandate/.test(hay)) return 'regulation';
  if (/rate cut|rate hike|federal funds|monetary/.test(hay)) return 'monetary_policy';
  return 'other';
}

export interface GateResult {
  canProceedToCompanyMapping: boolean;
  eventType: EventType;
  reasons: string[];
  warnings: string[];
}

// INV-004: for product-specific policy, company mapping cannot start while
// product scope is empty. Three outcomes: resolved (proceed), partially
// resolved (proceed with visible warning), unresolved (stop).
export function productScopeGate(contract: TriggerContract): GateResult {
  const eventType = classifyEventType(contract);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!contract.primaryActor || !contract.action) reasons.push('actor and action are required before mapping');
  if (contract.status === 'unknown') reasons.push('policy status is unknown; resolve before mapping');

  if (PRODUCT_SPECIFIC.includes(eventType)) {
    const products = contract.targetedProducts?.value ?? [];
    if (products.length === 0) {
      reasons.push(
        `event type "${eventType}" is product-specific and targeted products are empty; ` +
          'resolve the product scope (official annex, product list, or trade codes) or stop the run',
      );
    } else if (contract.targetedProducts.confidence === 'unknown') {
      warnings.push('product scope present but unverified; analysis is bounded to the stated products');
    }
  }

  return { canProceedToCompanyMapping: reasons.length === 0, eventType, reasons, warnings };
}

// Unsupported-number scanner (section 11.3). Walks display text, extracts
// numeric claims, and requires each to appear in the cited source text.
// Percent signs, currency amounts, and bare multi-digit numbers all count;
// years alone do not fail (timing language is validated separately).
const NUM_TOKEN = /(\$?\d[\d,]*(?:\.\d+)?\s?(?:%|percent(?:age points?)?|billion|million|trillion)?)/gi;

interface NumToken {
  value: number;
  unit: string; // '%', 'pp', 'billion', 'million', 'trillion', '$', or ''
}

function tokenize(text: string): NumToken[] {
  const out: NumToken[] = [];
  for (const m of text.matchAll(NUM_TOKEN)) {
    const raw = m[1].trim();
    const bare = raw.replace(/[^\d.]/g, '');
    if (!bare) continue;
    const value = Number(bare);
    if (!Number.isFinite(value)) continue;
    const lower = raw.toLowerCase();
    const unit = /percentage point/.test(lower)
      ? 'pp'
      : /%|percent/.test(lower)
        ? '%'
        : /billion/.test(lower)
          ? 'billion'
          : /million/.test(lower)
            ? 'million'
            : /trillion/.test(lower)
              ? 'trillion'
              : raw.startsWith('$')
                ? '$'
                : '';
    out.push({ value, unit });
  }
  return out;
}

export interface UnsupportedNumber {
  token: string;
  context: string;
}

// A claim number is supported only if the source contains a number token with
// the same value (unit-compatible: an exact-unit match, or a bare source
// token with the same value). Substring matching is forbidden: "10" must not
// pass because "2010" appears somewhere in the source.
export function findUnsupportedNumbers(claimText: string, sourceText: string): UnsupportedNumber[] {
  const sourceTokens = tokenize(sourceText);
  const supported = (t: NumToken) =>
    sourceTokens.some((s) => s.value === t.value && (s.unit === t.unit || s.unit === '' || t.unit === ''));
  const out: UnsupportedNumber[] = [];
  for (const m of claimText.matchAll(NUM_TOKEN)) {
    const raw = m[1].trim();
    const bare = raw.replace(/[^\d.]/g, '');
    if (!bare) continue;
    const value = Number(bare);
    if (!Number.isFinite(value)) continue;
    // Bare 4-digit years are timing, not magnitude; validated separately.
    if (/^(19|20)\d{2}$/.test(bare) && !/%|percent|billion|million/i.test(raw)) continue;
    // Single-digit bare ordinals (1st order, top 3) are structural.
    if (bare.length === 1 && !/%|percent|billion|million|\$/i.test(raw)) continue;
    const [tok] = tokenize(raw);
    if (!tok || supported(tok)) continue;
    const i = m.index ?? 0;
    out.push({ token: raw, context: claimText.slice(Math.max(0, i - 60), i + raw.length + 40).replace(/\s+/g, ' ') });
  }
  return out;
}
