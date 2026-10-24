import { NextResponse } from "next/server";
import { isValidISODate, todayISO } from "@/lib/dates";
import { getDailyKakuro, getDailyNonogram, getDailySolitaire, getDailySudoku } from "@/lib/games/dailyPuzzles";

/**
 * A past day's daily puzzle for the archive (/archive) and challenges:
 * GET ?game=sudoku|solitaire|nonogram|kakuro&date=YYYY-MM-DD[&draw=1|3]. The stored row, or the
 * same puzzle regenerated from its seed. Past puzzles never change, so the
 * CDN keeps them for a day; today's only for a minute (it's on the page).
 */

const FIRST = "2026-10-01";
const GAMES = new Set(["sudoku", "solitaire", "nonogram", "kakuro"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const date = url.searchParams.get("date") ?? "";
  const draw = url.searchParams.get("draw") === "3" ? 3 : 1;
  const today = todayISO();
  if (!game || !GAMES.has(game) || !isValidISODate(date) || date < FIRST || date > today) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const data =
      game === "sudoku"
        ? await getDailySudoku(date)
        : game === "nonogram"
          ? await getDailyNonogram(date)
          : game === "kakuro"
            ? await getDailyKakuro(date)
            : await getDailySolitaire(date, draw);
    const maxAge = date < today ? 86_400 : 60;
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } });
  } catch (err) {
    console.error(`daily-puzzle ${game} ${date}: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
