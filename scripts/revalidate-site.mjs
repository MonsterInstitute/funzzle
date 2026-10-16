/**
 * Refresh the pages that change daily (today's pages + the answer pages for the
 * given dates) via the site's protected on-demand revalidation route
 * (app/api/revalidate). Replaces the old full redeploy after each content run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/revalidate-site.mjs                 # today's pages
 *   node --env-file=.env.local scripts/revalidate-site.mjs --last=8        # + last 8 days of answers
 *   node --env-file=.env.local scripts/revalidate-site.mjs 2026-07-01 ...  # + specific dates
 *
 * Env: REVALIDATE_SECRET (required; same value as the Worker's secret),
 *      SITE_URL (optional, default https://www.funzzle.com).
 */

const SITE_URL = (process.env.SITE_URL || "https://www.funzzle.com").replace(/\/$/, "");

/** POST the dates to /api/revalidate. Returns true on success; never throws. */
export async function revalidateSite(dates = []) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    console.warn("No REVALIDATE_SECRET set — skipping revalidation.");
    return false;
  }
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret, "content-type": "application/json" },
      body: JSON.stringify({ dates }),
    });
    const body = await res.text();
    console.log(`Revalidate ${SITE_URL}: ${res.status} ${body.slice(0, 200)}`);
    return res.ok;
  } catch (err) {
    console.error(`Revalidate ${SITE_URL} failed: ${err.message}`);
    return false;
  }
}

function lastDays(n) {
  const today = new Date().toISOString().slice(0, 10);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const lastArg = args.find((a) => a.startsWith("--last="));
  const dates = [
    ...args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)),
    ...(lastArg ? lastDays(Number.parseInt(lastArg.slice("--last=".length), 10)) : []),
  ];
  const ok = await revalidateSite(dates);
  if (!ok) process.exit(1);
}
