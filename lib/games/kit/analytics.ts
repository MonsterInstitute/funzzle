/**
 * Product analytics. Sent with sendBeacon to /api/events (Workers Analytics
 * Engine), so a page unload never waits on it and failures are silent.
 */
import { stampPassport } from "./passport";
import { clientId, readString, writeString } from "./storage";

export type AnalyticsEvent =
  | "visit"
  | "game_start"
  | "game_complete"
  | "hint_used"
  | "share"
  | "return_visit"
  | "challenge_create"
  | "challenge_complete"
  | "league_create"
  | "league_join"
  | "reminder_optin"
  | "rewarded_ad";

export function track(event: AnalyticsEvent, game?: string, props: Record<string, string | number | boolean> = {}, ref?: string): void {
  if (game && (event === "game_start" || event === "game_complete")) stampPassport(game);
  try {
    const body = JSON.stringify({ event, game, clientId: clientId(), props, ref });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/events", blob)) {
      void fetch("/api/events", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics never breaks a game.
  }
}

const DAY_MS = 86_400_000;

/**
 * Once per UTC day per browser: `visit` with the first-seen day and the
 * referrer (traffic source, AI referrals, D1/D7/D30 return rates), plus
 * return_visit for a browser seen on an earlier day.
 */
export function trackVisit(): void {
  const today = new Date().toISOString().slice(0, 10);
  const last = readString("fz:lastVisit");
  if (last === today) return;
  writeString("fz:lastVisit", today);
  let firstSeen = readString("fz:firstSeen");
  if (!firstSeen) {
    firstSeen = last ?? today;
    writeString("fz:firstSeen", firstSeen);
  }
  const age = Math.round((Date.parse(today) - Date.parse(firstSeen)) / DAY_MS);
  track("visit", undefined, { first: firstSeen, age, path: location.pathname.slice(0, 80) }, document.referrer);
  if (last) track("return_visit", undefined, { since: last });
}
