/**
 * D1 over Cloudflare's REST API, for scripts that run outside the Worker
 * (backfills, one-off migrations, the weekly report). The Worker itself uses
 * the DB binding (lib/db.ts).
 *
 * Auth: CLOUDFLARE_API_TOKEN (needs D1 Edit, or D1 Read for read-only use),
 * else the local `wrangler login` token. Account: CLOUDFLARE_ACCOUNT_ID, else
 * the token's only account.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DATABASE_ID = process.env.D1_DATABASE_ID || "550335eb-16b4-4fcd-a469-6e3f3a79a78a";
const API = "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 30_000;

function wranglerToken() {
  for (const dir of [path.join(os.homedir(), "Library/Preferences/.wrangler"), path.join(os.homedir(), ".config/.wrangler"), path.join(os.homedir(), ".wrangler")]) {
    try {
      const m = fs.readFileSync(path.join(dir, "config/default.toml"), "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } catch {
      // not this one
    }
  }
  return null;
}

export function cloudflareToken() {
  const token = process.env.CLOUDFLARE_API_TOKEN || wranglerToken();
  if (!token) throw new Error("Set CLOUDFLARE_API_TOKEN (or run `wrangler login`)");
  return token;
}

let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || null;
export async function cloudflareAccountId() {
  if (accountId) return accountId;
  const body = await cf("/accounts");
  if (body.result.length !== 1) throw new Error("Set CLOUDFLARE_ACCOUNT_ID: the token sees several accounts");
  return (accountId = body.result[0].id);
}

/** Cloudflare API call; throws on a non-success response. */
export async function cf(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${cloudflareToken()}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(`Cloudflare ${pathname}: ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 300)}`);
  }
  return body;
}

/** Run one statement; returns its rows. */
export async function d1(sql, params = []) {
  const acc = await cloudflareAccountId();
  const body = await cf(`/accounts/${acc}/d1/database/${DATABASE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({ sql, params }),
  });
  return body.result[0].results;
}
