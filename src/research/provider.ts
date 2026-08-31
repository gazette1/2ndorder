// Research provider interface (master prompt 10.2). Three implementations:
// fixture (deterministic tests), direct (fetches explicitly supplied
// authoritative URLs through the article extractor), and disabled (returns a
// structured unavailable state; never fake content). There is no credentialed
// search API this week, so query-driven live search stays a seam; the run
// manifest declares the mode of every document so fixture content can never
// masquerade as live research.
import fs from 'node:fs';
import path from 'node:path';
import { fetchArticleText } from '../lib/article.js';
import type { ResearchDoc } from '../types.js';

export interface ResearchQuery {
  queryId: string;
  query: string;
  // Direct mode: explicit authoritative URLs to fetch for this query.
  urls?: string[];
  fixtureName?: string;
}

export type ResearchMode = 'fixture' | 'direct' | 'disabled';

export function researchMode(): ResearchMode {
  const m = (process.env.RESEARCH_PROVIDER ?? 'disabled').toLowerCase();
  return m === 'fixture' || m === 'direct' ? m : 'disabled';
}

const FIXTURES = path.resolve('fixtures/research');

export async function runQuery(q: ResearchQuery, mode: ResearchMode = researchMode()): Promise<ResearchDoc[]> {
  if (mode === 'fixture') {
    const p = path.join(FIXTURES, `${q.fixtureName ?? q.queryId}.json`);
    if (!fs.existsSync(p)) {
      return [{ queryId: q.queryId, mode: 'unavailable', url: null, title: 'fixture missing', text: '', evidenceId: null }];
    }
    const docs = JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{ url?: string; title: string; text: string }>;
    return docs.map((d) => ({ queryId: q.queryId, mode: 'fixture', url: d.url ?? null, title: d.title, text: d.text, evidenceId: null }));
  }
  if (mode === 'direct' && q.urls?.length) {
    const out: ResearchDoc[] = [];
    for (const url of q.urls.slice(0, 3)) {
      try {
        const a = await fetchArticleText(url);
        out.push({ queryId: q.queryId, mode: 'live', url, title: a.title, text: a.text, evidenceId: null });
      } catch (e) {
        out.push({ queryId: q.queryId, mode: 'unavailable', url, title: `fetch failed: ${String((e as Error).message).slice(0, 80)}`, text: '', evidenceId: null });
      }
    }
    return out;
  }
  return [{ queryId: q.queryId, mode: 'unavailable', url: null, title: 'research_unavailable', text: '', evidenceId: null }];
}
