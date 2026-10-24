import { NextResponse } from "next/server";
import { isValidISODate, todayISO } from "@/lib/dates";
import { getDailyFreeCell, getDailyHive, getDailyLetterBox, getDailyMahjong, getDailyMinesweeper, getDailySolitaire, getDailySpider, getDailySudoku, getStoredDailySpider, MAHJONG_DAILY_LAYOUT } from "@/lib/games/dailyPuzzles";
import { generateHive } from "@/lib/games/hive/generate";
import { generateLetterBox } from "@/lib/games/letterbox/generate";

/**
 * A past day's daily puzzle for the archive (/archive) and challenges:
 * GET ?game=<game>&date=YYYY-MM-DD[&draw=1|3]. The stored row, or the
 * same puzzle regenerated from its seed. Past puzzles never change, so the
 * CDN keeps them for a day; today's only for a minute (it's on the page).
 *
 * Word games also serve practice puzzles here, because their generators need
 * the server-only lexicon: GET ?game=spelling-hive|letter-box&practice=<seed>.
 */

const FIRST = "2026-10-01";
const WORD_GAMES = new Set(["spelling-hive", "letter-box"]);
const PRACTICE_SEED_RE = /^[a-z0-9-]{8,64}$/;

/** Games with an archive: each loads a date's stored (or regenerated) daily puzzle. */
const LOADERS: Record<string, (date: string, draw: 1 | 3, suits: 1 | 2 | 4) => Promise<unknown>> = {
  sudoku: (date) => getDailySudoku(date),
  solitaire: (date, draw) => getDailySolitaire(date, draw),
  freecell: (date) => getDailyFreeCell(date),
  minesweeper: (date) => getDailyMinesweeper(date),
  // Only the Turtle has dailies (MAHJONG_DAILY_LAYOUT); ?layout= is accepted for clarity.
  mahjong: (date) => getDailyMahjong(date),
  // 2 and 4 suits are pre-generated (too heavy for a Worker): 404 until stored.
  "spider-solitaire": (date, _draw, suits) => (suits === 1 ? getDailySpider(date) : getStoredDailySpider(date, suits)),
  "spelling-hive": (date) => getDailyHive(date),
  "letter-box": (date) => getDailyLetterBox(date),
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const date = url.searchParams.get("date") ?? "";
  const draw = url.searchParams.get("draw") === "3" ? 3 : 1;
  const suits = url.searchParams.get("suits") === "4" ? 4 : url.searchParams.get("suits") === "2" ? 2 : 1;
  const layout = url.searchParams.get("layout") ?? MAHJONG_DAILY_LAYOUT;
  const today = todayISO();
  const wordGame = !!game && WORD_GAMES.has(game);

  // A practice puzzle is a pure function of its seed: cacheable for good.
  const practice = url.searchParams.get("practice");
  if (practice !== null && wordGame) {
    if (!PRACTICE_SEED_RE.test(practice)) return NextResponse.json({ error: "bad request" }, { status: 400 });
    try {
      const seed = `${game}-practice:${practice}`;
      const data = game === "spelling-hive" ? generateHive(seed) : generateLetterBox(seed);
      return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=31536000, immutable" } });
    } catch (err) {
      console.error(`practice ${game} ${practice}: ${(err as Error).message}`);
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
  }

  if (!game || !Object.hasOwn(LOADERS, game) || (game === "mahjong" && layout !== MAHJONG_DAILY_LAYOUT) || !isValidISODate(date) || date < FIRST || date > today) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const data = await LOADERS[game](date, draw, suits);
    if (!data) return NextResponse.json({ error: "not stored" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } });
    const maxAge = date < today ? 86_400 : 60;
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } });
  } catch (err) {
    console.error(`daily-puzzle ${game} ${date}: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
