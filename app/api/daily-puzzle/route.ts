import { NextResponse } from "next/server";
import { isValidISODate, todayISO } from "@/lib/dates";
import { getDailyHive, getDailyLetterBox, getDailySolitaire, getDailySudoku } from "@/lib/games/dailyPuzzles";
import { generateHive } from "@/lib/games/hive/generate";
import { generateLetterBox } from "@/lib/games/letterbox/generate";

/**
 * A past day's daily puzzle for the archive (/archive) and challenges:
 * GET ?game=sudoku|solitaire|spelling-hive|letter-box&date=YYYY-MM-DD[&draw=1|3].
 * The stored row, or the same puzzle regenerated from its seed. Past puzzles
 * never change, so the CDN keeps them for a day; today's only for a minute
 * (it's on the page).
 *
 * Word games also serve practice puzzles here, because their generators need
 * the server-only lexicon: GET ?game=spelling-hive|letter-box&practice=<seed>.
 */

const FIRST = "2026-10-01";
const WORD_GAMES = new Set(["spelling-hive", "letter-box"]);
const PRACTICE_SEED_RE = /^[a-z0-9-]{8,64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const game = url.searchParams.get("game");
  const date = url.searchParams.get("date") ?? "";
  const draw = url.searchParams.get("draw") === "3" ? 3 : 1;
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

  if ((game !== "sudoku" && game !== "solitaire" && !wordGame) || !isValidISODate(date) || date < FIRST || date > today) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const data =
      game === "sudoku"
        ? await getDailySudoku(date)
        : game === "spelling-hive"
          ? await getDailyHive(date)
          : game === "letter-box"
            ? await getDailyLetterBox(date)
            : await getDailySolitaire(date, draw);
    const maxAge = date < today ? 86_400 : 60;
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}` } });
  } catch (err) {
    console.error(`daily-puzzle ${game} ${date}: ${(err as Error).message}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
