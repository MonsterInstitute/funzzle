import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/dates";
import { pathsToRevalidate } from "@/lib/revalidation";
import { logRun } from "@/lib/cron/runLog";
import { todayISO } from "@/lib/dates";
import { changedUrls, submitIndexNow } from "@/lib/indexnow";
import { isCronRequest, secretMatches } from "@/lib/secret";

/**
 * On-demand revalidation of the pages that change daily (lib/revalidation.ts),
 * replacing the daily redeploy.
 *
 *   POST /api/revalidate   x-revalidate-secret: $REVALIDATE_SECRET
 *        { "dates": ["2026-10-01", …] }   optional: extra answer dates (backfill)
 *        — called by scripts/revalidate-site.mjs (manual backfills).
 *   GET  /api/revalidate   Authorization: Bearer $CRON_SECRET
 *        — Cloudflare Cron Trigger just after midnight UTC (wrangler.jsonc ->
 *          worker.ts), rolls "today" over.
 */

function run(dates: string[]) {
  const paths = pathsToRevalidate(dates);
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ revalidated: paths.length, paths });
}

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let dates: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.dates)) dates = body.dates;
  } catch {
    // No body: today's pages only.
  }
  if (dates.length > 400 || !dates.every((d) => typeof d === "string" && isValidISODate(d))) {
    return NextResponse.json({ error: "dates must be up to 400 YYYY-MM-DD strings" }, { status: 400 });
  }
  return run(dates);
}

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  const res = run([]);
  // Today's pages just changed: tell IndexNow engines (Bing & co.) to recrawl.
  const indexNow = await submitIndexNow(changedUrls(todayISO()));
  await logRun("rollover", startedAt, true, { revalidated: pathsToRevalidate([]).length, indexNow });
  return res;
}
