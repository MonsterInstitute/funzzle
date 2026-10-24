import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The app database: Cloudflare D1 (binding DB, migrations/). In the Worker the
 * binding comes from the request context; during `next build` and `next dev`
 * getCloudflareContext({async: true}) starts Wrangler's platform proxy, which
 * reaches the production database because the binding is marked "remote".
 *
 * Every call has a client-side deadline: a D1 call that stalls fails after
 * QUERY_TIMEOUT_MS instead of holding the request (and its CPU/memory) open.
 * D1 has no connections to time out, so this deadline is the whole guard.
 */

const QUERY_TIMEOUT_MS = 8_000;

export class DbError extends Error {
  constructor(what: string, cause: unknown) {
    super(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "DbError";
  }
}

export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as CloudflareEnv).DB;
  if (!db) throw new DbError("getDb", "the DB binding is missing (wrangler.jsonc d1_databases)");
  return db;
}

function withDeadline<T>(promise: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbError(what, `timed out after ${QUERY_TIMEOUT_MS} ms`)), QUERY_TIMEOUT_MS);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

async function run<T>(what: string, fn: (db: D1Database) => Promise<T>): Promise<T> {
  try {
    // The deadline covers the query only: in the Worker getDb() is a property
    // read, and at build time it waits once for Wrangler's proxy to start.
    const db = await getDb();
    return await withDeadline(fn(db), what);
  } catch (err) {
    throw err instanceof DbError ? err : new DbError(what, err);
  }
}

/** All rows of one statement. Throws DbError on any failure. */
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
  return run(sql.slice(0, 60), async (db) => (await db.prepare(sql).bind(...params).all<T>()).results);
}

/** First row or null. Throws DbError on any failure. */
export function first<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | null> {
  return run(sql.slice(0, 60), (db) => db.prepare(sql).bind(...params).first<T>());
}

/** Run a write; returns the number of rows changed. Throws DbError on any failure. */
export function exec(sql: string, ...params: unknown[]): Promise<number> {
  return run(sql.slice(0, 60), async (db) => (await db.prepare(sql).bind(...params).run()).meta.changes ?? 0);
}

/** Several statements in one round trip, atomically (a D1 batch is a transaction). */
export function batch(statements: [sql: string, ...params: unknown[]][]): Promise<number> {
  return run(`batch of ${statements.length}`, async (db) => {
    const results = await db.batch(statements.map(([sql, ...params]) => db.prepare(sql).bind(...params)));
    return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
  });
}

/** Parse a JSON TEXT column (null stays null). */
export function parseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

/** Current time as stored in timestamp columns. */
export const nowIso = () => new Date().toISOString();
