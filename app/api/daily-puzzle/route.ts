import { NextResponse } from "next/server";
import { isValidISODate, todayISO } from "@/lib/dates";
import { getDailySolitaire, getDailySpider, getDailySudoku, getStoredDailySpider } from "@/lib/games/dailyPuzzles";

/**
 * A past day's daily puzzle for the archive (/archive) and challenges:
 * GET ?game=sudoku|solitaire|spider-solitaire&date=YYYY-MM-DD[&draw=1|3][&suits=1|2|4].
 * The stored row, or the same puzzle regenerated from its seed — except 4-suit
 * Spider, which is far too slow to generate on a request (404 until stored). Past puzzles never change, so the
 * CDN keeps them for a day; today's only for a minute (it's on the page).
 */

const FIRST = "2026-10-01";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const date = url.searchParams.get("date") ?? "";
  const draw = url.searchParams.get("draw") === "3" ? 3 : 1;
  const suits = url.searchParams.get("suits") === "4" ? 4 : url.searchParams.get("suits") === "2" ? 2 : 1;
  const today = todayISO();
  if ((game !== "sudoku" && game !== "solitaire" && game !== "spider-solitaire") || !isValidISODate(date) || date < FIRST || date > today) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const data =
      game === "sudoku"
        ? await getDailySudoku(date)
        : game === "solitaire"
          ? await getDailySolitaire(date, draw)
          : suits === 4
            ? await getStoredDailySpider(date, 4)
            : await getDailySpider(date, suits);
    if (!data) return NextResponse.json({ error: "not stored" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } });
    const maxAge = date < today ? 86_400 : 60;
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } });
  } catch (err) {
    console.error(`daily-puzzle ${game} ${date}: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
