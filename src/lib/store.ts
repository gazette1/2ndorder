import fs from 'node:fs';
import path from 'node:path';

// Local JSON store mirroring the Supabase schema in supabase/migrations/0001_init.sql.
// Both Supabase projects on the account are paused, so the scaffold persists each stage
// to data/runs/<slug>/ in the same shapes; swapping to supabase-js is a write-path change only.

export function runDir(slug: string): string {
  const dir = path.resolve('data/runs', slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function save(slug: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(runDir(slug), `${name}.json`), JSON.stringify(value, null, 2));
}

export function load<T>(slug: string, name: string): T {
  const p = path.join(runDir(slug), `${name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${name}.json for run "${slug}". Run the earlier stage first.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

export function saveText(slug: string, rel: string, text: string): void {
  const p = path.join(runDir(slug), rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
