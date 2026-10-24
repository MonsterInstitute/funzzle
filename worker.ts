// Worker entry: wraps the OpenNext handler with
//
//  1. host handling, as on Vercel: the apex 308s to www (path and query
//     kept). Only the www and apex routes reach the Worker (workers_dev is
//     off), but any other hostname would be served with noindex and a
//     disallow-all robots.txt so it can never be indexed as a duplicate.
//  2. Cron Triggers (wrangler.jsonc): every scheduled job. Each schedule calls
//     its route in-process with `Authorization: Bearer $CRON_SECRET`. A
//     non-2xx response (or a throw) emails an alert to ALERT_EMAIL_TO and then
//     throws, so the run also shows as failed in the dashboard.

// `.open-next/worker.js` exists only after a build, so this must compile both
// with and without it: @ts-expect-error would fail once it exists.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

const PRODUCTION_HOST = "www.funzzle.com";
const APEX_HOST = "funzzle.com";

/** Cron expression (wrangler.jsonc "triggers") -> route it runs. */
const CRON_ROUTES: Record<string, string> = {
  "1 0 * * *": "/api/revalidate",
  "5 2,3,6,14,22,23 * * *": "/api/cron/answers",
  "20 3,7,15,23 * * *": "/api/cron/explain",
};

type Env = {
  CRON_SECRET?: string;
  ALERT_EMAIL?: SendEmail;
  ALERT_EMAIL_TO?: string;
  ALERT_EMAIL_FROM?: string;
  /** Secret: an already-verified address, used while ALERT_EMAIL_TO is unverified. */
  ALERT_EMAIL_FALLBACK?: string;
};

/**
 * Email a cron failure. Email Routing only delivers to verified destination
 * addresses, so if ALERT_EMAIL_TO is refused the alert goes to
 * ALERT_EMAIL_FALLBACK. Never throws: the run is already failing.
 */
async function alert(env: Env, subject: string, text: string): Promise<void> {
  if (!env.ALERT_EMAIL || !env.ALERT_EMAIL_FROM) {
    console.error(JSON.stringify({ m: "alert-not-configured", subject }));
    return;
  }
  for (const to of [env.ALERT_EMAIL_TO, env.ALERT_EMAIL_FALLBACK]) {
    if (!to) continue;
    try {
      await env.ALERT_EMAIL.send({ from: env.ALERT_EMAIL_FROM, to, subject, text } as unknown as EmailMessage);
      return;
    } catch (err) {
      console.error(JSON.stringify({ m: "alert-failed", to, subject, error: (err as Error).message }));
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === APEX_HOST) {
      return Response.redirect(`https://${PRODUCTION_HOST}${url.pathname}${url.search}`, 308);
    }

    if (url.hostname !== PRODUCTION_HOST) {
      if (url.pathname === "/robots.txt") {
        return new Response("User-agent: *\nDisallow: /\n", {
          headers: { "content-type": "text/plain", "x-robots-tag": "noindex, nofollow" },
        });
      }
      const res: Response = await handler.fetch(request, env, ctx);
      const headers = new Headers(res.headers);
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }

    return handler.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const path = CRON_ROUTES[controller.cron];
    const when = new Date(controller.scheduledTime).toISOString();
    let failure: string | null = null;
    let body = "";
    if (!path) failure = `No route for cron "${controller.cron}"`;
    else if (!env.CRON_SECRET) failure = "CRON_SECRET is not set — cron routes would reject the call";
    else {
      try {
        const request = new Request(`https://${PRODUCTION_HOST}${path}`, {
          headers: { authorization: `Bearer ${env.CRON_SECRET}`, "user-agent": "cloudflare-cron" },
        });
        const res: Response = await handler.fetch(request, env, ctx);
        body = await res.text();
        console.log(JSON.stringify({ m: "cron", cron: controller.cron, path, status: res.status, body: body.slice(0, 2000) }));
        if (!res.ok) failure = `${path} returned ${res.status}`;
      } catch (err) {
        failure = `${path} threw: ${(err as Error).message}`;
      }
    }
    if (failure) {
      await alert(
        env,
        `[funzzle] cron failed: ${path ?? controller.cron}`,
        `Cron "${controller.cron}" scheduled at ${when} failed.\n\n${failure}\n\nResponse:\n${body.slice(0, 8000)}\n\nRuns: SELECT * FROM cron_runs ORDER BY id DESC LIMIT 20 (wrangler d1 execute funzzle-db --remote).`
      );
      throw new Error(failure);
    }
  },
} satisfies ExportedHandler<Env>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { DOQueueHandler } from "./.open-next/worker.js";
