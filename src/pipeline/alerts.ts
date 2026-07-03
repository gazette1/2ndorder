import fs from 'node:fs';
import path from 'node:path';
import { submissions } from '../lib/edgar.js';
import { load, runDir, save } from '../lib/store.js';
import type { Alert, Candidate } from '../types.js';

// A run is a report; a standing scenario is a subscription. This stage re-checks
// every in-band name for filings since the run (or since the last check) and
// writes alerts.json. Scheduling the re-run is a deployment concern (cron); the
// check itself is this function.

const WATCH_FORMS = new Set(['8-K', '4', '10-K', '10-Q', 'SC 13D', 'SC 13G']);
const NOTES: Record<string, string> = {
  '8-K': 'material event',
  '4': 'insider transaction',
  '10-K': 'annual report',
  '10-Q': 'quarterly report',
  'SC 13D': 'activist stake',
  'SC 13G': 'passive stake',
};

export async function checkAlerts(slug: string): Promise<{ generatedAt: string; since: string; alerts: Alert[] }> {
  const run = load<{ createdAt: string }>(slug, 'run');
  const candidates = load<Candidate[]>(slug, 'candidates').filter((c) => c.status === 'in_band');

  const prior = path.join(runDir(slug), 'alerts.json');
  const since = fs.existsSync(prior)
    ? (JSON.parse(fs.readFileSync(prior, 'utf8')) as { generatedAt: string }).generatedAt.slice(0, 10)
    : run.createdAt.slice(0, 10);

  const alerts: Alert[] = [];
  for (const c of candidates.slice(0, 20)) {
    try {
      const subs = await submissions(c.cik);
      const r = subs.recent;
      for (let i = 0; i < r.form.length; i++) {
        if (r.filingDate[i] <= since) break; // recent lists are newest-first
        const form = r.form[i];
        if (!WATCH_FORMS.has(form)) continue;
        alerts.push({
          ticker: c.ticker,
          form,
          filedAt: r.filingDate[i],
          accession: r.accessionNumber[i],
          note: NOTES[form] ?? 'filing',
        });
      }
    } catch (e) {
      console.warn(`[alerts] ${c.ticker}: ${(e as Error).message}`);
    }
  }

  alerts.sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const result = { generatedAt: new Date().toISOString(), since, alerts };
  save(slug, 'alerts', result);
  console.log(`[alerts] ${alerts.length} filings on watched names since ${since}`);
  return result;
}
