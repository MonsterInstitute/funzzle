import { NextResponse } from "next/server";
import { UUID_RE } from "@/lib/apiValidate";
import { exec } from "@/lib/db";

/**
 * Web push opt-in for the daily reminder (lib/cron/reminders.ts).
 *   POST   {subscription: PushSubscriptionJSON, clientId} → 204
 *   DELETE {endpoint}                                      → 204
 */

const B64URL = /^[A-Za-z0-9_-]+$/;

function validEndpoint(e: unknown): e is string {
  if (typeof e !== "string" || e.length > 1000) return false;
  try {
    return new URL(e).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; clientId?: unknown } | null;
  const sub = body?.subscription;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  const clientId = String(body?.clientId ?? "");
  if (
    !validEndpoint(sub?.endpoint) ||
    typeof p256dh !== "string" ||
    !B64URL.test(p256dh) ||
    p256dh.length > 200 ||
    typeof auth !== "string" ||
    !B64URL.test(auth) ||
    auth.length > 100 ||
    !UUID_RE.test(clientId)
  ) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    await exec(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, client_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, client_id = excluded.client_id, failures = 0`,
      sub!.endpoint,
      p256dh,
      auth,
      clientId
    );
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`push subscribe: ${(err as Error).message}`);
    return new NextResponse(null, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!validEndpoint(body?.endpoint)) return new NextResponse(null, { status: 400 });
  try {
    await exec("DELETE FROM push_subscriptions WHERE endpoint = ?", body!.endpoint);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`push unsubscribe: ${(err as Error).message}`);
    return new NextResponse(null, { status: 503 });
  }
}
