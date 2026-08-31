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

// Full model-call provenance: the raw response next to its prompt, plus one
// JSONL line per call with model, tier, endpoint, token usage, cost, and
// latency. The audit object for a run is prompts/ + outputs/ +
// model-calls.jsonl together.
function saveProvenance(
  slug: string,
  key: string,
  rawResponse: string,
  meta: {
    provider: string;
    model: string;
    tier: Tier;
    baseURL?: string;
    promptChars: number;
    promptTokens?: number;
    completionTokens?: number;
    costUSD?: number;
    durationMs: number;
  },
) {
  const safeKey = key.replace(/[/\\]/g, '_');
  const outDir = path.resolve('data/runs', slug, 'outputs');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${safeKey}.txt`), rawResponse);
  const line = JSON.stringify({ at: new Date().toISOString(), key: safeKey, ...meta });
  fs.appendFileSync(path.resolve('data/runs', slug, 'model-calls.jsonl'), line + '\n');
}

export async function llm(slug: string, key: string, prompt: string, format: Format, tier: Tier = 'light'): Promise<string> {
  savePrompt(slug, key, prompt);
  const { provider } = CONFIG.llm;
  const model = CONFIG.llm.models[tier];

  if (provider === 'ollama') {
    const started = Date.now();
    const text = await callOllama(prompt, format, model);
    saveProvenance(slug, key, text, {
      provider,
      model,
      tier,
      promptChars: prompt.length,
      durationMs: Date.now() - started,
    });
    return finish(text, format);
  }
  if (provider === 'openai') {
    const started = Date.now();
    const r = await callOpenAiCompatible(prompt, format, model, tier);
    saveProvenance(slug, key, r.text, {
      provider,
      model,
      tier,
      baseURL: CONFIG.llm.endpoints[tier].baseURL,
      promptChars: prompt.length,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      costUSD: r.costUSD,
      durationMs: Date.now() - started,
    });
    return finish(r.text, format);
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

// Any OpenAI-compatible chat completions endpoint, resolved per tier so heavy
// and light can run on different hosts (Kimi K2 heavy, DeepSeek light).
async function callOpenAiCompatible(
  prompt: string,
  format: Format,
  model: string,
  tier: Tier,
): Promise<{ text: string; promptTokens?: number; completionTokens?: number; costUSD?: number }> {
  const endpoint = CONFIG.llm.endpoints[tier];
  const key = endpoint.apiKey;
  if (!key) throw new Error(`LLM_PROVIDER=openai needs an API key for the ${tier} tier (OPENAI_API_KEY or LLM_${tier.toUpperCase()}_API_KEY).`);
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: endpoint.temperature,
  };
  if (format === 'json') body.response_format = { type: 'json_object' };
  const res = await fetch(`${endpoint.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const usage = data.usage;
  let costUSD: number | undefined;
  if (usage) {
    const price = PRICE_PER_TOKEN[tier];
    costUSD = (usage.prompt_tokens ?? 0) * price.in + (usage.completion_tokens ?? 0) * price.out;
    spentUSD += costUSD;
  }
  console.log(`[llm] openai-compatible ${model} @ ${endpoint.baseURL} (spent so far $${spentUSD.toFixed(3)})`);
  return {
    text: String(data.choices?.[0]?.message?.content ?? ''),
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    costUSD,
  };
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model response contained no JSON object.');
  return text.slice(start, end + 1);
}
