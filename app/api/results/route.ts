import { NextResponse } from "next/server";
import { shiftISODate, todayISO } from "@/lib/dates";
import { HISTOGRAM_BUCKETS, RESULT_GAMES } from "@/lib/games/kit/resultConfig";
import { createServiceSupabase } from "@/lib/supabase";

/**
 * Anonymous daily results for the recap's "faster than N% of today's players".
 *
 *   POST {game, date, variant, clientId, timeMs, mistakes, hints, moves?}
 *        → {percentile, count, buckets, lo, hi}. A browser's first result for
 *        a puzzle is the one that counts; resubmits return the same stats.
 *   GET  ?game=&date=&variant= → {count, buckets, lo, hi} (CDN-cached 60 s).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Today, or yesterday for a puzzle finished just after midnight UTC. */
function isOpenDate(date: string): boolean {
  const today = todayISO();
  return date === today || date === shiftISODate(today, -1);
}

async function dayStats(game: string, date: string, variant: string) {
  const { lo, hi } = RESULT_GAMES[game];
  const supabase = createServiceSupabase();
  const { data, error } = await supabase.rpc("daily_result_stats", {
    p_game: game,
    p_date: date,
    p_variant: variant,
    p_lo: lo,
    p_hi: hi,
    p_buckets: HISTOGRAM_BUCKETS,
  });
  if (error) throw new Error(`daily_result_stats: ${error.message}`);
  const stats = data as { count: number; buckets: number[] };
  return { count: stats.count, buckets: stats.buckets, lo, hi };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game") ?? "";
  const date = url.searchParams.get("date") ?? "";
  const variant = url.searchParams.get("variant") ?? "";
  const config = RESULT_GAMES[game];
  if (!config || !config.variants.includes(variant) || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await dayStats(game, date, variant), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error((err as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const game = String(body.game ?? "");
  const date = String(body.date ?? "");
  const variant = String(body.variant ?? "");
  const clientId = String(body.clientId ?? "");
  const config = RESULT_GAMES[game];
  const timeMs = intIn(body.timeMs, config?.minMs ?? 1, DAY_MS);
  const mistakes = intIn(body.mistakes, 0, 999);
  const hints = intIn(body.hints, 0, 999);
  const moves = body.moves === undefined ? null : intIn(body.moves, 0, 100_000);
  if (
    !config ||
    !config.variants.includes(variant) ||
    !DATE_RE.test(date) ||
    !isOpenDate(date) ||
    !UUID_RE.test(clientId) ||
    timeMs === null ||
    mistakes === null ||
    hints === null ||
    (body.moves !== undefined && moves === null)
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabase();
    const { error: insertError } = await supabase.from("game_results").upsert(
      { game, puzzle_date: date, variant, client_id: clientId, time_ms: timeMs, mistakes, hints, moves },
      { onConflict: "game,puzzle_date,variant,client_id", ignoreDuplicates: true }
    );
    if (insertError) throw new Error(`game_results insert: ${insertError.message}`);

    // Percentile against everyone else, using the stored (first) time.
    const { data: mine, error: mineError } = await supabase
      .from("game_results")
      .select("time_ms")
      .eq("game", game)
      .eq("puzzle_date", date)
      .eq("variant", variant)
      .eq("client_id", clientId)
      .single();
    if (mineError) throw new Error(`game_results read: ${mineError.message}`);
    const { count: slower, error: slowerError } = await supabase
      .from("game_results")
      .select("id", { count: "exact", head: true })
      .eq("game", game)
      .eq("puzzle_date", date)
      .eq("variant", variant)
      .gt("time_ms", mine.time_ms);
    if (slowerError) throw new Error(`game_results count: ${slowerError.message}`);

    const stats = await dayStats(game, date, variant);
    const others = stats.count - 1;
    const percentile = others > 0 ? Math.round((100 * (slower ?? 0)) / others) : null;
    return NextResponse.json({ ...stats, percentile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error((err as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
