import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { shiftISODate, todayISO } from "@/lib/dates";
import { pathsToRevalidate } from "@/lib/revalidation";
import { isCronRequest } from "@/lib/secret";
import { createServiceSupabase } from "@/lib/supabase";
import { fetchConnections, fetchMini, fetchWordle } from "@/scripts/fetch-public-answers.mjs";

/**
 * Fills in any missing answer rows for today and tomorrow (UTC) straight from
 * the public sources — no LLM, so it is fast and cheap. A Cloudflare Cron
 * Trigger runs it on the minute (wrangler.jsonc -> worker.ts), which GitHub's
 * schedule can't guarantee:
 *
 *   22:05, 23:05 UTC  tomorrow's Wordle + Connections (NYT publishes them days
 *                     ahead) and weekend Minis (released 18:00 ET) land BEFORE
 *                     the date begins; the 00:01 revalidation publishes them.
 *   02:05, 03:05 UTC  weekday Minis, released 22:00 ET (02:00 UTC in EDT,
 *                     03:00 UTC in EST) — the earliest they exist anywhere.
 *   06:05, 14:05 UTC  retries.
 *
 * Existing rows are never overwritten: the Daily Content workflow later
 * replaces these rows with copies that carry DeepSeek explanations.
 */

export const maxDuration = 60;

const GAMES = [
  { type: "wordle", fetch: fetchWordle },
  { type: "connections", fetch: fetchConnections },
  { type: "nyt-mini", fetch: fetchMini },
] as const;

type Result = { date: string; type: string } & (
  | { status: "present" }
  | { status: "written"; source: string }
  | { status: "missing"; error: string }
);

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayISO();
  const dates = [today, shiftISODate(today, 1)];
  const supabase = createServiceSupabase();

  const { data: existing, error } = await supabase
    .from("answers")
    .select("publish_date, type")
    .in("publish_date", dates);
  if (error) {
    console.error(`answers cron: reading existing rows failed: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const present = new Set(existing.map((r) => `${r.publish_date}|${r.type}`));

  const results: Result[] = await Promise.all(
    dates.flatMap((date) =>
      GAMES.map(async (game): Promise<Result> => {
        if (present.has(`${date}|${game.type}`)) return { date, type: game.type, status: "present" };
        try {
          const { answer_data, source } = await game.fetch(date);
          const { error: insErr } = await supabase
            .from("answers")
            .insert({ publish_date: date, type: game.type, answer_data, summary: null });
          // 23505: another writer stored this row first (unique index on
          // answers(publish_date, type)) — it exists, which is all we need.
          if (insErr?.code === "23505") return { date, type: game.type, status: "present" };
          if (insErr) throw new Error(`insert failed: ${insErr.message}`);
          return { date, type: game.type, status: "written", source };
        } catch (err) {
          return { date, type: game.type, status: "missing", error: (err as Error).message };
        }
      })
    )
  );

  for (const r of results) {
    if (r.status === "written") console.log(`answers cron: wrote ${r.date} ${r.type} [${r.source}]`);
    if (r.status === "missing") console.warn(`answers cron: ${r.date} ${r.type} still missing — ${r.error}`);
  }

  // Tomorrow's rows need no refresh now: the 00:01 UTC revalidation publishes them.
  const wroteToday = results.some((r) => r.status === "written" && r.date === today);
  if (wroteToday) for (const p of pathsToRevalidate()) revalidatePath(p);

  // Today's answers should always exist by now; a gap is an error worth seeing in the logs.
  const todayMissing = results.filter((r) => r.status === "missing" && r.date === today);
  return NextResponse.json(
    { today, revalidated: wroteToday, results },
    { status: todayMissing.length ? 502 : 200 }
  );
}
