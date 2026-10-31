import { getCloudflareContext } from "@opennextjs/cloudflare";

type SendEmail = { send(message: Record<string, unknown>): Promise<unknown> };

/**
 * Email hello@funzzle.com (ALERT_EMAIL_TO, falling back to ALERT_EMAIL_FALLBACK)
 * from inside a route, for warnings that aren't a failed run (worker.ts emails
 * failed runs itself). Returns whether a send succeeded; never throws.
 */
export async function sendAlertEmail(subject: string, text: string): Promise<boolean> {
  const env = getCloudflareContext().env as unknown as {
    ALERT_EMAIL?: SendEmail;
    ALERT_EMAIL_TO?: string;
    ALERT_EMAIL_FROM?: string;
    ALERT_EMAIL_FALLBACK?: string;
  };
  if (!env.ALERT_EMAIL || !env.ALERT_EMAIL_FROM) return false;
  for (const to of [env.ALERT_EMAIL_TO, env.ALERT_EMAIL_FALLBACK]) {
    if (!to) continue;
    try {
      await env.ALERT_EMAIL.send({ from: env.ALERT_EMAIL_FROM, to, subject, text });
      return true;
    } catch (err) {
      console.error(JSON.stringify({ m: "alert-failed", to, subject, error: (err as Error).message }));
    }
  }
  return false;
}
