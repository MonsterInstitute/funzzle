import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { referralSource } from "@/lib/referral";

/**
 * Analytics sink for lib/games/kit/analytics.ts (sendBeacon, fire-and-forget).
 * Events go to Workers Analytics Engine (dataset funzzle_events), not D1, so
 * they never use database write quota. Data point layout — keep in sync with
 * the queries in scripts/gsc-report.mjs:
 *
 *   index1   event
 *   blob1    event        blob2  game ("" if none)   blob3  client id
 *   blob4    referral source (lib/referral.ts)       blob5  country
 *   blob6    props JSON (≤ 1 KB)
 *   double1  1 (count)
 */

const EVENTS = new Set([
  "visit",
  "game_start",
  "game_complete",
  "hint_used",
  "share",
  "return_visit",
  "challenge_create",
  "challenge_complete",
  "league_create",
  "league_join",
  "reminder_optin",
  "rewarded_ad",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const MAX_PROPS_BYTES = 1024;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const event = String(body.event ?? "");
  const game = body.game === undefined || body.game === null ? "" : String(body.game);
  const clientId = String(body.clientId ?? "");
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? body.props : {};
  const propsJson = JSON.stringify(props);
  if (!EVENTS.has(event) || (game !== "" && !SLUG_RE.test(game)) || !UUID_RE.test(clientId) || propsJson.length > MAX_PROPS_BYTES) {
    return new NextResponse(null, { status: 400 });
  }
  const ref = typeof body.ref === "string" ? body.ref.slice(0, 300) : "";
  const { env, cf } = getCloudflareContext();
  const country = (cf as { country?: string } | undefined)?.country ?? "";
  try {
    (env as CloudflareEnv).EVENTS.writeDataPoint({
      indexes: [event],
      blobs: [event, game, clientId, referralSource(ref), country, propsJson],
      doubles: [1],
    });
  } catch (err) {
    console.error(`analytics engine write: ${(err as Error).message}`);
    return new NextResponse(null, { status: 503 });
  }
  return new NextResponse(null, { status: 204 });
}
