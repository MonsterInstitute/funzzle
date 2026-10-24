import { NextResponse } from "next/server";
import { shiftISODate, todayISO } from "@/lib/dates";
import { HISTOGRAM_BUCKETS, RESULT_GAMES } from "@/lib/games/kit/resultConfig";
import { exec, first } from "@/lib/db";

/**
 * Anonymous daily results for the recap's "faster than N% of today's players".
 *
 *   POST {game, date, variant, clientId, timeMs, mistakes, hints, moves?}
 *        → {percentile, count, buckets, lo, hi}. A browser's first result for
 *        a puzzle is the one that counts; resubmits return the same stats.
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
  const { lo, hi } = RESULT_GAMES[game];
  const row = await first<{ count: number; buckets: string | null }>(
    `SELECT sum(n) AS count, json_group_array(json_array(b, n)) AS buckets FROM (
       SELECT CASE WHEN time_ms < ?1 THEN 1 WHEN time_ms >= ?2 THEN ?3
                   ELSE CAST((time_ms - ?1) * ?3 / (?2 - ?1) AS INTEGER) + 1 END AS b,
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
  return { count: row?.count ?? 0, buckets, lo, hi };
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
    // Score-ranked games need their score.
    ((config.order ?? "time") !== "time" && moves === null)
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
    const order = config.order ?? "time";
    const mine =
      order === "time"
        ? await first<{ slower: number }>(
            `SELECT count(*) AS slower FROM game_results
       WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3
         AND time_ms > (SELECT time_ms FROM game_results WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3 AND client_id = ?4)`,
            game,
            date,
            variant,
            clientId,
          )
        : // Score games: a better score wins, an equal score goes to the faster time.
          await first<{ slower: number }>(
            `SELECT count(*) AS slower FROM game_results r,
         (SELECT time_ms AS t, moves AS m FROM game_results WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3 AND client_id = ?4) me
       WHERE r.game = ?1 AND r.puzzle_date = ?2 AND r.variant = ?3
         AND (r.moves ${order === "score" ? "<" : ">"} me.m OR (r.moves = me.m AND r.time_ms > me.t))`,
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
