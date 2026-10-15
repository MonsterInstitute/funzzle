import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/dates";
import { pathsToRevalidate } from "@/lib/revalidation";
import { isVercelCron, secretMatches } from "@/lib/secret";

/**
 * On-demand revalidation of the pages that change daily (lib/revalidation.ts),
 * replacing the daily redeploy.
 *
 *   POST /api/revalidate   x-revalidate-secret: $REVALIDATE_SECRET
 *        { "dates": ["2026-10-01", …] }   optional: extra answer dates (backfill)
 *        — called by scripts/revalidate-site.mjs (Daily Content workflow).
 *   GET  /api/revalidate   Authorization: Bearer $CRON_SECRET
 *        — Vercel Cron just after midnight UTC (vercel.json), rolls "today" over.
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
  if (!isVercelCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return run([]);
}
