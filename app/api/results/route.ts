import { NextResponse } from "next/server";
import { shiftISODate, todayISO } from "@/lib/dates";
import { beatenSql, HISTOGRAM_BUCKETS, RESULT_GAMES } from "@/lib/games/kit/resultConfig";
import { exec, first } from "@/lib/db";

/**
 * Anonymous daily results for the recap's "faster than N% of today's players".
 *
 *   POST {game, date, variant, clientId, timeMs, mistakes, hints, moves?}
 *        → {percentile, count, buckets, lo, hi}. A browser's first result for
 *        a puzzle is the one that counts; resubmits return the same stats.
 *        Games ranked by moves (RESULT_GAMES rank "moves": Funzzle Word's
 *        guesses) must send moves; fewer moves rank first, then time.
 *   GET  ?game=&date=&variant= → {count, buckets, lo, hi} (CDN-cached 60 s).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

/** Today, or yesterday for a puzzle finished just after midnight UTC. */
function isOpenDate(date: string): boolean {
  const today = todayISO();
  return date === today || date === shiftISODate(today, -1);
}

/**
 * Count and histogram of one day's times. Bucket b (1…buckets) matches
 * Postgres' width_bucket(time_ms, lo, hi, buckets) clamped to the ends, as
 * the Postgres version did. CAST: D1 binds JS numbers as REAL.
 */
async function dayStats(game: string, date: string, variant: string) {
  const { lo, hi, histogram } = RESULT_GAMES[game];
  // The bucketed value: the time, or the score for histogram "score" games.
  const v = histogram === "score" ? "coalesce(moves, 0)" : "time_ms";
  const row = await first<{ count: number; buckets: string | null }>(
    `SELECT sum(n) AS count, json_group_array(json_array(b, n)) AS buckets FROM (
       SELECT CASE WHEN ${v} < ?1 THEN 1 WHEN ${v} >= ?2 THEN ?3
                   ELSE CAST((${v} - ?1) * ?3 / (?2 - ?1) AS INTEGER) + 1 END AS b,
              count(*) AS n
       FROM game_results WHERE game = ?4 AND puzzle_date = ?5 AND variant = ?6
       GROUP BY b)`,
    lo,
    hi,
    HISTOGRAM_BUCKETS,
    game,
    date,
    variant,
  );
  const buckets = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
  for (const [b, n] of JSON.parse(row?.buckets ?? "[]") as [
    number | null,
    number,
  ][]) {
    if (b !== null) buckets[b - 1] = n;
  }
  return { count: row?.count ?? 0, buckets, lo, hi, histogram: histogram ?? "time" };
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
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
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
    (body.moves !== undefined && moves === null) ||
    // Score/count-ranked games need their number.
    ((config.order ?? "time") !== "time" && (config.order ?? "time") !== "mistakes" && moves === null) ||
    // A count ("fewest": guesses, words) is at least 1.
    (config.order === "fewest" && moves !== null && moves < 1)
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    await exec(
      `INSERT INTO game_results (game, puzzle_date, variant, client_id, time_ms, mistakes, hints, moves)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      game,
      date,
      variant,
      clientId,
      timeMs,
      mistakes,
      hints,
      moves,
    );
    // Percentile against everyone else, using the stored (first) result.
    const mine = await first<{ slower: number }>(
      `SELECT count(*) AS slower FROM game_results r,
         (SELECT time_ms, moves, mistakes, hints FROM game_results WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3 AND client_id = ?4) me
       WHERE r.game = ?1 AND r.puzzle_date = ?2 AND r.variant = ?3 AND ${beatenSql(game)}`,
      game,
      date,
      variant,
      clientId,
    );
    const slower = mine?.slower ?? 0;

    const stats = await dayStats(game, date, variant);
    const others = stats.count - 1;
    const percentile = others > 0 ? Math.round((100 * slower) / others) : null;
    return NextResponse.json(
      { ...stats, percentile },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error((err as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
