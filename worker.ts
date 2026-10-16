// Worker entry: wraps the OpenNext handler with
//
//  1. host handling, as on Vercel: the apex 308s to www (path and query
//     kept). Any other hostname (funzzle.workers.dev, used to verify before
//     cutover) serves the same site with noindex and a disallow-all robots.txt.
//  2. Cron Triggers (wrangler.jsonc), which replace Vercel Cron. Each schedule
//     calls its route in-process with `Authorization: Bearer $CRON_SECRET`,
//     exactly the request Vercel Cron sent, so the routes are unchanged. A
//     non-2xx response throws, so the run shows as failed in the dashboard.

// `.open-next/worker.js` exists only after a build, so this must compile both
// with and without it: @ts-expect-error would fail once it exists.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

const PRODUCTION_HOST = "www.funzzle.com";
const APEX_HOST = "funzzle.com";

/** Cron expression (wrangler.jsonc "triggers") -> route it runs. */
const CRON_ROUTES: Record<string, string> = {
  "5 2,3,6,14,22,23 * * *": "/api/cron/answers",
  "1 0 * * *": "/api/revalidate",
};

type Env = { CRON_SECRET?: string };

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
    if (!path) throw new Error(`No route for cron "${controller.cron}"`);
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not set — cron routes would reject the call");

    const request = new Request(`https://${PRODUCTION_HOST}${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}`, "user-agent": "cloudflare-cron" },
    });
    const res: Response = await handler.fetch(request, env, ctx);
    const body = await res.text();
    console.log(JSON.stringify({ m: "cron", cron: controller.cron, path, status: res.status, body: body.slice(0, 2000) }));
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  },
} satisfies ExportedHandler<Env>;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export { DOQueueHandler } from "./.open-next/worker.js";
