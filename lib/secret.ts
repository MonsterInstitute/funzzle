import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret check. Fails closed: a missing secret (unset env var)
 * or a missing header never matches.
 */
export function secretMatches(given: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * True when the request carries `Authorization: Bearer $CRON_SECRET` — sent by
 * the Cron Triggers in worker.ts (wrangler.jsonc).
 */
export function isCronRequest(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return secretMatches(auth?.replace(/^Bearer /, ""), process.env.CRON_SECRET);
}
