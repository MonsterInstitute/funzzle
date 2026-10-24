import { getCloudflareContext } from "@opennextjs/cloudflare";
import { all, batch, exec } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { SITE_URL } from "@/lib/site";
import { sendPush, type Vapid } from "@/lib/webpush";

/**
 * Daily reminders, "Today's puzzles are ready": opt-in email
 * (email_subscribers) and web push (push_subscriptions). At most one per
 * channel per UTC day (last_sent_day). Browsers that already finished one of
 * today's puzzles get no push. A push endpoint the browser has dropped
 * (404/410) is deleted; three failures in a row delete it too.
 */

const BATCH = 50;
const FROM = "Funzzle <puzzles@funzzle.com>";

type Mailer = { send(message: Record<string, unknown>): Promise<unknown> };

export interface RemindersRun {
  ok: boolean;
  email: { sent: number; failed: number; error?: string };
  push: { sent: number; gone: number; failed: number; skipped: number; error?: string };
}

function emailBody(token: string) {
  const unsubscribe = `${SITE_URL}/daily-email/unsubscribe/${token}`;
  const oneClick = `${SITE_URL}/api/unsubscribe?token=${token}`;
  const text = `Today's Daily Set is ready: Sudoku, Solitaire, the word puzzle and the Mini Crossword. Same puzzles for everyone, so see where you rank.

Play: ${SITE_URL}/#today

Stuck on today's NYT puzzles? Hints first, answers only when you ask: ${SITE_URL}/#answers

You get this because you asked for Funzzle's daily reminder. Unsubscribe: ${unsubscribe}`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p><strong>Today's Daily Set is ready.</strong> Sudoku, Solitaire, the word puzzle and the Mini Crossword — the same puzzles for everyone, so see where you rank.</p>
<p><a href="${SITE_URL}/#today" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Play today's puzzles</a></p>
<p>Stuck on today's NYT puzzles? <a href="${SITE_URL}/#answers">Hints first, answers only when you ask.</a></p>
<p style="font-size:13px;color:#666">You get this because you asked for Funzzle's daily reminder. <a href="${unsubscribe}">Unsubscribe</a></p>
</div>`;
  return { text, html, oneClick };
}

async function sendEmails(today: string): Promise<RemindersRun["email"]> {
  const mailer = (getCloudflareContext().env as unknown as { MAILER?: Mailer }).MAILER;
  if (!mailer) return { sent: 0, failed: 0, error: "MAILER binding missing" };
  const subs = await all<{ email: string; unsubscribe_token: string }>(
    "SELECT email, unsubscribe_token FROM email_subscribers WHERE unsubscribed = 0 AND (last_sent_day IS NULL OR last_sent_day < ?) LIMIT 500",
    today
  );
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < subs.length; i += BATCH) {
    const chunk = subs.slice(i, i + BATCH);
    const ok: string[] = [];
    await Promise.all(
      chunk.map(async (s) => {
        const { text, html, oneClick } = emailBody(s.unsubscribe_token);
        try {
          await mailer.send({
            from: FROM,
            to: s.email,
            subject: "Today’s puzzles are ready",
            text,
            html,
            headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          });
          ok.push(s.email);
        } catch (err) {
          failed++;
          console.warn(`reminder email failed: ${(err as Error).message}`);
        }
      })
    );
    if (ok.length) await batch(ok.map((email) => ["UPDATE email_subscribers SET last_sent_day = ? WHERE email = ?", today, email]));
    sent += ok.length;
  }
  return { sent, failed };
}

async function sendPushes(today: string): Promise<RemindersRun["push"]> {
  const privateJwk = process.env.VAPID_PRIVATE_JWK;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!privateJwk || !publicKey) return { sent: 0, gone: 0, failed: 0, skipped: 0, error: "VAPID keys missing" };
  const vapid: Vapid = { publicKey, privateJwk, subject: "mailto:hello@funzzle.com" };
  const subs = await all<{ endpoint: string; p256dh: string; auth: string; client_id: string }>(
    "SELECT endpoint, p256dh, auth, client_id FROM push_subscriptions WHERE last_sent_day IS NULL OR last_sent_day < ? LIMIT 2000",
    today
  );
  const played = new Set(
    (await all<{ client_id: string }>("SELECT DISTINCT client_id FROM game_results WHERE puzzle_date = ?", today)).map((r) => r.client_id)
  );
  const counts = { sent: 0, gone: 0, failed: 0, skipped: 0 };
  const payload = { title: "Today’s puzzles are ready", body: "Your Daily Set is waiting: Sudoku, Solitaire, the word puzzle and the Mini.", url: "/#today", tag: `daily-${today}` };
  for (let i = 0; i < subs.length; i += BATCH) {
    const chunk = subs.slice(i, i + BATCH);
    const statements: [string, ...unknown[]][] = [];
    await Promise.all(
      chunk.map(async (s) => {
        if (played.has(s.client_id)) {
          counts.skipped++;
          statements.push(["UPDATE push_subscriptions SET last_sent_day = ? WHERE endpoint = ?", today, s.endpoint]);
          return;
        }
        const { outcome } = await sendPush(s, payload, vapid);
        counts[outcome === "sent" ? "sent" : outcome === "gone" ? "gone" : "failed"]++;
        if (outcome === "sent") statements.push(["UPDATE push_subscriptions SET last_sent_day = ?, failures = 0 WHERE endpoint = ?", today, s.endpoint]);
        else if (outcome === "gone") statements.push(["DELETE FROM push_subscriptions WHERE endpoint = ?", s.endpoint]);
        else statements.push(["UPDATE push_subscriptions SET failures = failures + 1, last_sent_day = ? WHERE endpoint = ?", today, s.endpoint]);
      })
    );
    if (statements.length) await batch(statements);
  }
  await exec("DELETE FROM push_subscriptions WHERE failures >= 3");
  return counts;
}

export async function runReminders(): Promise<RemindersRun> {
  const today = todayISO();
  const [email, push] = await Promise.all([
    sendEmails(today).catch((err) => ({ sent: 0, failed: 0, error: (err as Error).message })),
    sendPushes(today).catch((err) => ({ sent: 0, gone: 0, failed: 0, skipped: 0, error: (err as Error).message })),
  ]);
  // A single bounced address or dead endpoint is normal; a step that errored
  // outright, or failed for everyone, is worth an alert.
  const ok = !email.error && !push.error && !(email.failed > 0 && email.sent === 0) && !(push.failed > 0 && push.sent === 0 && push.failed > 2);
  return { ok, email, push };
}
