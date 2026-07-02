import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';

// Every prompt is written to disk before the call, so any output (live or fixture)
// can be audited against the exact prompt that produced it.
function savePrompt(slug: string, key: string, prompt: string) {
  const dir = path.resolve('data/runs', slug, 'prompts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key.replace(/[/\\]/g, '_')}.txt`), prompt);
}

// One entry point for every model call.
// Live mode: ANTHROPIC_API_KEY set -> claude-fable-5 over the API.
// Fixture mode: no key -> read fixtures/<slug>/<key>.<ext>, fail loudly if absent.
export async function fable(slug: string, key: string, prompt: string, format: 'json' | 'markdown'): Promise<string> {
  savePrompt(slug, key, prompt);

  if (process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: CONFIG.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('');
    return format === 'json' ? extractJson(text) : text;
  }

  const ext = format === 'json' ? 'json' : 'md';
  const fixture = path.resolve('fixtures', slug, `${key}.${ext}`);
  if (fs.existsSync(fixture)) {
    console.log(`[fable] fixture mode: ${path.relative(process.cwd(), fixture)}`);
    return fs.readFileSync(fixture, 'utf8');
  }
  throw new Error(
    `No ANTHROPIC_API_KEY and no fixture at ${fixture}. ` +
    `Set the key for live mode, or author the fixture against the saved prompt in data/runs/${slug}/prompts/.`,
  );
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model response contained no JSON object.');
  return text.slice(start, end + 1);
}
