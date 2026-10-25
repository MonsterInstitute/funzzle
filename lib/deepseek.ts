import { exec } from "@/lib/db";

/**
 * DeepSeek chat completions for the explain cron, with every call's token
 * usage and cost logged to llm_usage (the weekly report's cost section).
 * DeepSeek only ever rewords facts we already have (real answers, solver
 * steps); callers validate what comes back.
 */

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const TIMEOUT_MS = 120_000;

/** $ per 1M tokens for deepseek-flash: [cache hit, cache miss, output]. */
const PRICE = { offPeak: [0.003, 0.15, 0.6], peak: [0.006, 0.3, 1.2] } as const;

/** DeepSeek's peak hours: 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday. */
function isPeak(d: Date): boolean {
  const day = d.getUTCDay();
  const h = d.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}

export function hasDeepSeek(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

interface Usage {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
}

/** One JSON-mode completion; returns the parsed JSON object. Throws on any failure. */
export async function deepSeekJson<T = Record<string, unknown>>(job: string, prompt: string, maxTokens = 2048): Promise<T> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  const started = new Date();
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[]; usage?: Usage; model?: string };

  const u = body.usage ?? {};
  const hit = u.prompt_cache_hit_tokens ?? 0;
  const miss = u.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens ?? 0) - hit);
  const out = u.completion_tokens ?? 0;
  const [pHit, pMiss, pOut] = isPeak(started) ? PRICE.peak : PRICE.offPeak;
  const cost = (hit * pHit + miss * pMiss + out * pOut) / 1e6;
  await exec(
    "INSERT INTO llm_usage (day, job, model, prompt_tokens, cache_hit_tokens, completion_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)",
    started.toISOString().slice(0, 10),
    job,
    body.model ?? MODEL,
    hit + miss,
    hit,
    out,
    cost
  ).catch((err) => console.warn(`llm_usage write: ${(err as Error).message}`));

  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error(`DeepSeek reply cut off at ${maxTokens} tokens`);
  const text = choice?.message?.content ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("DeepSeek reply has no JSON object");
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error("DeepSeek reply is not valid JSON");
  }
}
