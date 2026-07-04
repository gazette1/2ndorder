import type { HiringSnapshot } from '../types.js';

// Where a company is hiring is capital allocation disclosed early. Greenhouse
// and Lever expose public JSON for their hosted job boards; coverage is
// whichever companies use them under a guessable slug, so a null result means
// "no board found", not "not hiring". Honest nulls only.

function slugGuesses(name: string, ticker: string): string[] {
  const base = name
    .toLowerCase()
    .replace(/,?\s+(inc|corp|corporation|co|company|ltd|plc|holdings?|group|technologies|technology)\.?$/gi, '')
    .trim();
  const tight = base.replace(/[^a-z0-9]/g, '');
  const dashed = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const first = base.split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') ?? '';
  const set = new Set([tight, dashed, first, ticker.toLowerCase()]);
  return [...set].filter((s) => s.length >= 2);
}

async function probeGreenhouse(slug: string): Promise<{ count: number; departments: string[] } | null> {
  try {
    // The departments endpoint returns role counts per department in one call;
    // the flat /jobs listing omits department tags.
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/departments`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { departments?: Array<{ name: string; jobs?: unknown[] }> };
    if (!data.departments) return null;
    const withJobs = data.departments
      .map((d) => ({ name: d.name, n: d.jobs?.length ?? 0 }))
      .filter((d) => d.n > 0);
    const count = withJobs.reduce((s, d) => s + d.n, 0);
    if (!count) return null;
    withJobs.sort((a, b) => b.n - a.n);
    return { count, departments: withJobs.slice(0, 3).map((d) => `${d.name} (${d.n})`) };
  } catch {
    return null;
  }
}

async function probeLever(slug: string): Promise<{ count: number; departments: string[] } | null> {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (research)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ categories?: { team?: string; department?: string } }>;
    if (!Array.isArray(data)) return null;
    const dep = new Map<string, number>();
    for (const j of data) {
      const d = j.categories?.department ?? j.categories?.team;
      if (d) dep.set(d, (dep.get(d) ?? 0) + 1);
    }
    const departments = [...dep.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`);
    return { count: data.length, departments };
  } catch {
    return null;
  }
}

export async function hiringSnapshot(name: string, ticker: string): Promise<HiringSnapshot | null> {
  for (const slug of slugGuesses(name, ticker)) {
    const gh = await probeGreenhouse(slug);
    if (gh && gh.count > 0) return { openRoles: gh.count, topDepartments: gh.departments, board: 'greenhouse', slug, provenance: 'job_board' };
    const lv = await probeLever(slug);
    if (lv && lv.count > 0) return { openRoles: lv.count, topDepartments: lv.departments, board: 'lever', slug, provenance: 'job_board' };
  }
  return null;
}
