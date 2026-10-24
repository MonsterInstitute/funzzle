/**
 * Product analytics: game_start, game_complete, hint_used, share,
 * return_visit. Sent with sendBeacon to /api/events (stored in Supabase), so
 * a page unload never waits on it and failures are silent.
 */
import { clientId, readString, writeString } from "./storage";

export type AnalyticsEvent = "game_start" | "game_complete" | "hint_used" | "share" | "return_visit";

export function track(event: AnalyticsEvent, game?: string, props: Record<string, string | number | boolean> = {}): void {
  try {
    const body = JSON.stringify({ event, game, clientId: clientId(), props });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob)) {
      void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics never breaks a game.
  }
}

/** Fires return_visit once per UTC day for a browser seen on an earlier day. */
export function trackVisit(): void {
  const today = new Date().toISOString().slice(0, 10);
  const last = readString("fz:lastVisit");
  if (last === today) return;
  writeString("fz:lastVisit", today);
  if (last) track("return_visit", undefined, { since: last });
}
