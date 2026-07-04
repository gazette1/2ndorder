import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';

// One entry point for every model call, provider-agnostic.
//   LLM_PROVIDER=fixture  (default) read fixtures/<slug>/<key>.<ext>, fail loudly if absent.
//   LLM_PROVIDER=ollama   local model over http://localhost:11434, free. LLM_MODEL sets the model.
//   LLM_PROVIDER=openai   any OpenAI-compatible endpoint (DeepSeek, Groq, Together, OpenRouter)
//                         via OPENAI_BASE_URL + OPENAI_API_KEY.
// The task is bounded: structured scoring from pre-extracted evidence and templated drafting
// under a fixed format, so a strong open model (gemma2, qwen2.5, deepseek) is adequate and
// far cheaper than a frontier model. The rubric arithmetic lives outside the model regardless.

type Format = 'json' | 'markdown';
export type Tier = 'heavy' | 'light';

// USD per token, cache-miss input, from the provider's published pricing. Local
// (ollama) and fixture calls cost nothing. Used to track real spend against a
// budget for long batch jobs (Hermes backfill); not billing-accurate to the cent,
// but close, since it reads the tokens the API itself reports per call.
const PRICE_PER_TOKEN: Record<Tier, { in: number; out: number }> = {
  light: { in: 0.14 / 1e6, out: 0.28 / 1e6 }, // deepseek-v4-flash
  heavy: { in: 0.435 / 1e6, out: 0.87 / 1e6 }, // deepseek-v4-pro
};

let spentUSD = 0;
export function getSpentUSD(): number {
  return spentUSD;
}
export function resetSpentUSD(): void {
  spentUSD = 0;
}

// Every prompt is written to disk before the call, so any output (live or fixture)
// can be audited against the exact prompt that produced it.
function savePrompt(slug: string, key: string, prompt: string) {
  const dir = path.resolve('data/runs', slug, 'prompts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key.replace(/[/\\]/g, '_')}.txt`), prompt);
}

export async function llm(slug: string, key: string, prompt: string, format: Format, tier: Tier = 'light'): Promise<string> {
  savePrompt(slug, key, prompt);
  const { provider } = CONFIG.llm;
  const model = CONFIG.llm.models[tier];

  if (provider === 'ollama') {
    return finish(await callOllama(prompt, format, model), format);
  }
  if (provider === 'openai') {
    return finish(await callOpenAiCompatible(prompt, format, model, tier), format);
  }

  const ext = format === 'json' ? 'json' : 'md';
  const fixture = path.resolve('fixtures', slug, `${key}.${ext}`);
  if (fs.existsSync(fixture)) {
    console.log(`[llm] fixture mode: ${path.relative(process.cwd(), fixture)}`);
    return fs.readFileSync(fixture, 'utf8');
  }
  throw new Error(
    `Provider is fixture and no fixture at ${fixture}. ` +
      `Set LLM_PROVIDER=ollama (with a pulled model) or =openai, or author the fixture ` +
      `against the saved prompt in data/runs/${slug}/prompts/.`,
  );
}

function finish(text: string, format: Format): string {
  const clean = deSlop(text);
  return format === 'json' ? extractJson(clean) : clean.trim();
}

// House style is a hard gate on generated output, and open models honor it
// inconsistently from the prompt alone (both gemma4 and deepseek-v4 emitted
// em-dashes). Enforce it deterministically. Range dashes ("20–30%", "[0]–[14]")
// become "to"; parenthetical em/en dashes become commas, per the voice rule.
function deSlop(text: string): string {
  return text
    .replace(/([\d\]%])\s*[–—]\s*([\d[$])/g, '$1 to $2')
    .replace(/\s*[—–]\s*/g, ', ');
}

// Local Ollama. format:'json' uses Ollama's JSON mode to constrain the output.
async function callOllama(prompt: string, format: Format, model: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    options: { temperature: 0.2 },
  };
  if (format === 'json') body.format = 'json';
  const res = await fetch(`${CONFIG.llm.ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  console.log(`[llm] ollama ${model}`);
  return String(data.message?.content ?? '');
}

// Any OpenAI-compatible chat completions endpoint.
async function callOpenAiCompatible(prompt: string, format: Format, model: string, tier: Tier): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('LLM_PROVIDER=openai needs OPENAI_API_KEY.');
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  };
  if (format === 'json') body.response_format = { type: 'json_object' };
  const res = await fetch(`${CONFIG.llm.openaiBaseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const usage = data.usage;
  if (usage) {
    const price = PRICE_PER_TOKEN[tier];
    spentUSD += (usage.prompt_tokens ?? 0) * price.in + (usage.completion_tokens ?? 0) * price.out;
  }
  console.log(`[llm] openai-compatible ${model} @ ${CONFIG.llm.openaiBaseURL} (spent so far $${spentUSD.toFixed(3)})`);
  return String(data.choices?.[0]?.message?.content ?? '');
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model response contained no JSON object.');
  return text.slice(start, end + 1);
}
