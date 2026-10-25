/**
 * Stand-in for lib/db.ts in local scripts bundled with
 * `--alias:@/lib/db=./scripts/lib/db-stub.ts`: never touches D1 (the real
 * module would start Wrangler's proxy to the production database). Reads
 * return nothing, writes are dropped, and llm_usage inserts are tallied so a
 * script can print what its DeepSeek calls cost.
 */
export const usage = { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 };

export class DbError extends Error {}

export async function getDb(): Promise<never> {
  throw new DbError("db-stub: no database in local scripts");
}

export async function all<T>(): Promise<T[]> {
  return [];
}

export async function first<T>(): Promise<T | null> {
  return null;
}

export async function exec(sql: string, ...params: unknown[]): Promise<number> {
  if (sql.includes("INSERT INTO llm_usage")) {
    // (day, job, model, prompt_tokens, cache_hit_tokens, completion_tokens, cost_usd)
    usage.calls++;
    usage.promptTokens += Number(params[3]) || 0;
    usage.completionTokens += Number(params[5]) || 0;
    usage.costUsd += Number(params[6]) || 0;
  }
  return 0;
}

export async function batch(statements: unknown[][]): Promise<number> {
  return statements.length;
}

export function parseJson<T>(value: unknown): T | null {
  try {
    return typeof value === "string" ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export const nowIso = () => new Date().toISOString();
