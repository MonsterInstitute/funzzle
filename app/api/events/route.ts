import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

/** Analytics sink for lib/games/kit/analytics.ts (sendBeacon, fire-and-forget). */

const EVENTS = new Set(["game_start", "game_complete", "hint_used", "share", "return_visit"]);
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
  const game = body.game === undefined || body.game === null ? null : String(body.game);
  const clientId = String(body.clientId ?? "");
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? body.props : {};
  if (
    !EVENTS.has(event) ||
    (game !== null && !SLUG_RE.test(game)) ||
    !UUID_RE.test(clientId) ||
    JSON.stringify(props).length > MAX_PROPS_BYTES
  ) {
    return new NextResponse(null, { status: 400 });
  }
  const { error } = await createServiceSupabase()
    .from("game_events")
    .insert({ event, game, client_id: clientId, props });
  if (error) {
    console.error(`game_events insert: ${error.message}`);
    return new NextResponse(null, { status: 503 });
  }
  return new NextResponse(null, { status: 204 });
}
