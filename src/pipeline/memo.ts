import fs from 'node:fs';
import path from 'node:path';
import { load, runDir } from '../lib/store.js';
import { CONFIG } from '../config.js';
import rubric from '../rubric.json' with { type: 'json' };
import type { Candidate, ChainNode, Decomposition, Dossier, MacroContext, Read, Thesis } from '../types.js';

// The IC memo: one self-contained HTML document per run, print-to-PDF ready.
// Scenario, the consequence map, the ranked list, then the theses with their
// evidence. Every filing claim keeps its link to the SEC document.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal markdown for the fixed house format: #/## headings, paragraphs,
// bullets, bold, [n] citations left as-is (resolved in the evidence section).
function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }
    const bullet = t.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length + 1; // demote: thesis h1 becomes h2 inside the memo
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    out.push(`<p>${inline(t)}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function money(n: number | null): string {
  if (n === null) return 'not reported';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}MM`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}M`;
  return `${sign}$${abs}`;
}

// Market caps in MM, rendered comma-free: $2.54B at billion scale, $640MM below.
function capMM(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'n/a';
  if (v >= 1000) {
    const b = v / 1000;
    return `$${b >= 100 ? Math.round(b) : b.toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  return `$${Math.round(v)}MM`;
}

export function buildMemo(slug: string): string {
  const run = load<{ seed: string; createdAt: string; asof?: string | null; counterOf?: string | null }>(slug, 'run');
  const { nodes } = load<Decomposition>(slug, 'decompose');
  const candidates = load<Candidate[]>(slug, 'candidates');
  const reads = load<Read[]>(slug, 'reads');
  const dossiers = load<Dossier[]>(slug, 'dossiers');
  const scores = load<Record<string, number>>(slug, 'scores');
  const theses = load<Thesis[]>(slug, 'theses');
  const macro = (() => {
    try {
      return load<MacroContext>(slug, 'macro');
    } catch {
      return null;
    }
  })();

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inBand = candidates.filter((c) => c.status === 'in_band');
  const byOrder = [...new Set(nodes.map((n) => n.order))].sort();

  const mapRows = byOrder
    .map((order) => {
      const rows = nodes
        .filter((n) => n.order === order)
        .map((n) => {
          const k = inBand.filter((c) => c.nodeId === n.id).length;
          const parent = n.parentId ? nodeById.get(n.parentId)?.name ?? '' : 'scenario';
          return `<tr>
            <td>${order}</td>
            <td class="${n.polarity === 'at_risk' ? 'risk' : 'ben'}">${n.polarity === 'at_risk' ? 'at risk' : 'beneficiary'}</td>
            <td><strong>${esc(n.name)}</strong>${n.whiteSpace ? ' <span class="ws">white space</span>' : ''}<br /><span class="muted">${esc(n.mechanism)}</span></td>
            <td class="muted">${esc(parent)}</td>
            <td>${n.horizon}</td>
            <td>${k} names, ${n.filingHits ?? 0} filings</td>
          </tr>`;
        });
      return rows.join('\n');
    })
    .join('\n');

  const ranked = [...reads]
    .sort((a, b) => (scores[b.ticker] ?? 0) - (scores[a.ticker] ?? 0))
    .map((r) => {
      const c = candidates.find((x) => x.ticker === r.ticker);
      const d = dossiers.find((x) => x.ticker === r.ticker);
      const node = c ? nodeById.get(c.nodeId) : undefined;
      return `<tr>
        <td class="mono">${esc(r.ticker)}</td>
        <td>${esc(c?.name ?? '')}</td>
        <td>${esc(node?.name ?? '')}</td>
        <td>${capMM(c?.marketCapMM)}</td>
        <td>${r.exposure}</td>
        <td>${d ? money(d.insider.netBuyUSD) : ''}</td>
        <td>${scores[r.ticker] ?? ''}</td>
        <td class="muted">${esc((d?.reality?.flags ?? []).join('; ') || 'clean')}</td>
      </tr>`;
    })
    .join('\n');

  const thesisSections = theses
    .map((t) => {
      const read = reads.find((r) => r.ticker === t.ticker);
      const quotes = (read?.quotes ?? [])
        .map(
          (q, i) =>
            `<li><span class="mono">[${i}]</span> ${esc(q.text)} <span class="muted">(${esc(q.form)}, filed ${esc(q.filedAt)}, <a href="${esc(q.url)}">SEC document</a>)</span></li>`,
        )
        .join('\n');
      return `<section class="thesis">
        ${mdToHtml(t.markdown)}
        <details><summary>Evidence: exact filing sentences cited above</summary><ul>${quotes}</ul></details>
      </section>`;
    })
    .join('\n<hr />\n');

  const macroSection = macro
    ? `<h2>Macro context</h2>
<table>
<tr><th>Series</th><th>Latest</th><th>As of</th><th>Year over year</th></tr>
${macro.series
  .map(
    (s) =>
      `<tr><td>${esc(s.label)} <span class="mono muted">${esc(s.id)}</span></td><td>${s.latest}</td><td>${esc(s.asof)}</td><td>${
        s.yoyPct !== null ? s.yoyPct + ' percent' : 'n/a'
      }</td></tr>`,
  )
  .join('\n')}
</table>
<p class="meta">${esc(macro.note)}</p>`
    : '';

  // Per-name evidence appendix: material 8-Ks, significant holders, proxy read,
  // earnings-release language, hiring. All free primary or near-primary sources.
  const evidenceSections = [...reads]
    .sort((a, b) => (scores[b.ticker] ?? 0) - (scores[a.ticker] ?? 0))
    .map((r) => {
      const d = dossiers.find((x) => x.ticker === r.ticker);
      if (!d) return '';
      const parts: string[] = [];
      const signalEvents = (d.events ?? []).filter((e) => e.signal).slice(0, 5);
      if (signalEvents.length) {
        parts.push(
          `<p><strong>Material 8-K events, trailing 12 months.</strong></p><ul>${signalEvents
            .map((e) => `<li>${esc(e.filedAt)}: ${esc(e.items.map((i) => i.label).join(', '))} (<a href="${esc(e.url)}">filing</a>)</li>`)
            .join('')}</ul>`,
        );
      }
      const holders = (d.holders ?? []).filter((h) => h.holder);
      if (holders.length) {
        parts.push(
          `<p><strong>Significant holders (13D/13G).</strong> ${holders
            .map((h) => `${esc(h.holder!)}${h.percent !== null ? ` ${h.percent} percent` : ''}${h.activist ? ' (13D, active intent)' : ''}`)
            .join('; ')}.</p>`,
        );
      }
      const g = d.governance;
      if (g && (g.ceoCompUSD || g.relatedParty || g.notes)) {
        const bits = [
          g.ceoCompUSD ? `CEO total comp ${money(g.ceoCompUSD)}` : null,
          g.relatedParty,
          g.notes,
        ].filter(Boolean);
        parts.push(`<p><strong>Proxy (DEF 14A, filed ${esc(g.filedAt)}).</strong> ${esc(bits.join(' '))} <a href="${esc(g.proxyUrl)}">Proxy</a>.</p>`);
      }
      const lang = d.earningsLanguage;
      if (lang?.emphasis) {
        parts.push(
          `<p><strong>Earnings release language${lang.releasesRead > 1 ? ', two most recent' : ''}.</strong> ${esc(lang.emphasis)}${
            lang.drift ? ' ' + esc(lang.drift) : ''
          }${lang.hedges.length ? ` Recurring hedges: ${esc(lang.hedges.map((h) => `"${h}"`).join(', '))}.` : ''} <span class="muted">Read from press releases filed as 8-K exhibits, not call transcripts.</span></p>`,
        );
      }
      if (d.hiring) {
        parts.push(
          `<p><strong>Hiring.</strong> ${d.hiring.openRoles} open roles on the company job board${
            d.hiring.topDepartments.length ? `, led by ${esc(d.hiring.topDepartments.join(', '))}` : ''
          }.</p>`,
        );
      }
      if (d.regulator) {
        const items = d.regulator.items.map((i) => `${i.date ? i.date + ': ' : ''}${i.text}`).join('; ');
        parts.push(`<p><strong>Regulator (${esc(d.regulator.agency)}).</strong> ${esc(d.regulator.headline)}.${items ? ' ' + esc(items) + '.' : ''}</p>`);
      }
      if (!parts.length) return '';
      return `<h3 class="mono">${esc(r.ticker)}</h3>\n${parts.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n');

  const weights = Object.entries(rubric.weights)
    .map(([k, w]) => `<tr><td>${esc(k)}</td><td>${w}</td><td class="muted">${esc((rubric.definitions as any)[k] ?? '')}</td></tr>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>IC memo: ${esc(run.seed)}</title>
<style>
  body { font-family: Georgia, serif; color: #16181d; margin: 40px auto; max-width: 820px; padding: 0 24px; line-height: 1.55; }
  h1 { font-size: 26px; line-height: 1.2; }
  h2 { font-size: 19px; margin-top: 28px; }
  h3 { font-size: 16px; }
  table { border-collapse: collapse; width: 100%; font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; margin: 12px 0; }
  th, td { border-bottom: 1px solid #d8dce2; text-align: left; padding: 6px 8px; vertical-align: top; }
  th { font-weight: 600; }
  .mono { font-family: Consolas, monospace; }
  .muted { color: #5c6470; }
  .ben { color: #0f6e56; }
  .risk { color: #a32d2d; }
  .ws { color: #854f0b; font-size: 11px; border: 1px dashed #854f0b; border-radius: 3px; padding: 0 4px; }
  .meta { color: #5c6470; font-size: 13px; font-family: "Segoe UI", system-ui, sans-serif; }
  .thesis { margin: 18px 0; }
  details { font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; margin-top: 8px; }
  hr { border: none; border-top: 1px solid #d8dce2; margin: 24px 0; }
  a { color: #185fa5; }
  @media print { body { margin: 12px; } details { display: none; } }
</style>
</head>
<body>
<h1>IC memo: ${esc(run.seed)}</h1>
<p class="meta">Run ${esc(slug)}, generated ${new Date().toISOString().slice(0, 10)}. Market cap band ${capMM(CONFIG.capBandMM[0])} to ${capMM(CONFIG.capBandMM[1])}.${run.asof ? ` Filings as of ${esc(run.asof)}.` : ''}${run.counterOf ? ` Counter-scenario of run ${esc(run.counterOf)}.` : ''} Draft for analyst review, not investment advice. Every filing claim links to its SEC document. Market caps are delayed price times reported shares (10-K public float as fallback), not a licensed market data feed.</p>

<h2>Consequence map</h2>
<table>
<tr><th>Order</th><th>Direction</th><th>Consequence and mechanism</th><th>Follows from</th><th>Horizon</th><th>Evidence</th></tr>
${mapRows}
</table>

${macroSection}

<h2>Ranked names</h2>
<table>
<tr><th>Ticker</th><th>Company</th><th>Map node</th><th>Mkt cap</th><th>Exposure</th><th>Insider net 12m</th><th>Composite</th><th>Reality flags</th></tr>
${ranked}
</table>

${evidenceSections ? `<h2>Company evidence</h2>\n${evidenceSections}` : ''}

<h2>Rubric</h2>
<table>
<tr><th>Dimension</th><th>Weight</th><th>Definition</th></tr>
${weights}
</table>

<h2>Theses</h2>
${thesisSections}
</body>
</html>`;
}

export function writeMemo(slug: string): string {
  const html = buildMemo(slug);
  const p = path.join(runDir(slug), 'memo.html');
  fs.writeFileSync(p, html);
  console.log(`[memo] ${path.relative(process.cwd(), p)} (${Math.round(html.length / 1024)} KB)`);
  return p;
}
