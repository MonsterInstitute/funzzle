/**
 * Daily reminder opt-in on the client: web push (service worker + VAPID) and
 * email. The server sends at most one of each per day (lib/cron/reminders.ts).
 */
import { track } from "./analytics";
import { clientId } from "./storage";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return !!(await reg?.pushManager.getSubscription());
}

/** Ask permission, subscribe and register with the server. Returns the outcome. */
export async function enablePush(): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), clientId: clientId() }),
    });
    if (!res.ok) return "error";
    track("reminder_optin", undefined, { channel: "push" });
    return "on";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe();
}

export async function subscribeEmail(email: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
    if (res.ok && data.ok) {
      track("reminder_optin", undefined, { channel: "email" });
      return { ok: true, message: "Done. One email a day when the new puzzles are ready." };
    }
    return { ok: false, message: data.error ?? "Something went wrong." };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}
