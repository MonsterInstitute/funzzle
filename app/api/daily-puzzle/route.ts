import { NextResponse } from "next/server";
import { isValidISODate, todayISO } from "@/lib/dates";
import { getDailyFreeCell, getDailyMahjong, getDailyMinesweeper, getDailySolitaire, getDailySudoku, MAHJONG_DAILY_LAYOUT } from "@/lib/games/dailyPuzzles";

/**
 * A past day's daily puzzle for the archive (/archive) and challenges:
 * GET ?game=<game>&date=YYYY-MM-DD[&draw=1|3]. The stored row, or the
 * same puzzle regenerated from its seed. Past puzzles never change, so the
 * CDN keeps them for a day; today's only for a minute (it's on the page).
 */

const FIRST = "2026-10-01";

/** Games with an archive: each loads a date's stored (or regenerated) daily puzzle. */
const LOADERS: Record<string, (date: string, draw: 1 | 3) => Promise<unknown>> = {
  sudoku: (date) => getDailySudoku(date),
  solitaire: (date, draw) => getDailySolitaire(date, draw),
  freecell: (date) => getDailyFreeCell(date),
  minesweeper: (date) => getDailyMinesweeper(date),
  // Only the Turtle has dailies (MAHJONG_DAILY_LAYOUT); ?layout= is accepted for clarity.
  mahjong: (date) => getDailyMahjong(date),
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const date = url.searchParams.get("date") ?? "";
  const draw = url.searchParams.get("draw") === "3" ? 3 : 1;
  const layout = url.searchParams.get("layout") ?? MAHJONG_DAILY_LAYOUT;
  const today = todayISO();
  if (!game || !Object.hasOwn(LOADERS, game) || (game === "mahjong" && layout !== MAHJONG_DAILY_LAYOUT) || !isValidISODate(date) || date < FIRST || date > today) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const data = await LOADERS[game](date, draw);
    const maxAge = date < today ? 86_400 : 60;
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } });
  } catch (err) {
    console.error(`daily-puzzle ${game} ${date}: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
