/**
 * Daily puzzles: one per game per UTC day, the same for everyone.
 *
 * The stored row in daily_puzzles is the source of truth (written ahead of
 * time by the answers cron), so a later
 * generator change never swaps a puzzle people are already playing. When the
 * row doesn't exist yet the page generates the same puzzle from the same seed.
 * A database error throws instead: a cached page built from a fallback during
 * an outage could differ from the stored puzzle.
 */
import { generateSudoku, type Grid } from "@/lib/games/sudoku";
import { dailyDeal, type Move, type State } from "@/lib/games/solitaire";
import { dailyDeal as dailyFreeCellDeal, type Move as FreeCellMove, type State as FreeCellState } from "@/lib/games/freecell";
import { dailyBoard, type Board } from "@/lib/games/minesweeper";
import { dailyDeal as mahjongDailyDeal, type LayoutId, type Pair, type State as MahjongState } from "@/lib/games/mahjong";
import { dailyDeal as spiderDailyDeal, type Move as SpiderMove, type State as SpiderState, type SuitCount } from "@/lib/games/spider";
import { MINESWEEPER_DAILY_LEVEL, sudokuDifficultyFor, type SudokuDifficulty } from "./dailySchedule";
import { all, batch, first, parseJson } from "@/lib/db";

export interface DailySudoku {
  date: string;
  difficulty: SudokuDifficulty;
  puzzle: Grid;
  solution: Grid;
}

export interface DailySolitaire {
  date: string;
  draw: 1 | 3;
  seed: string;
  state: State;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: Move[];
}

export interface DailyFreeCell {
  date: string;
  seed: string;
  state: FreeCellState;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: FreeCellMove[];
}

/** The day's no-guess board (it opens at the center cell), plus its date. */
export interface DailyMinesweeper extends Board {
  date: string;
}

export interface DailyMahjong {
  date: string;
  layout: LayoutId;
  seed: string;
  state: MahjongState;
  /** Winning line replayed to an empty board: proof the deal can be cleared. */
  solution: Pair[];
}

export interface DailySpider {
  date: string;
  suits: SuitCount;
  seed: string;
  state: SpiderState;
  /** Winning line found by the solver: proof the deal is winnable. */
  solution: SpiderMove[];
}

/** Daily Mahjong is always the 144-tile Turtle. */
export const MAHJONG_DAILY_LAYOUT: LayoutId = "turtle";

async function readRow<T>(game: string, date: string, variant: string): Promise<T | null> {
  const row = await first<{ data: string }>(
    "SELECT data FROM daily_puzzles WHERE game = ? AND puzzle_date = ? AND variant = ?",
    game,
    date,
    variant
  );
  return row ? parseJson<T>(row.data) : null;
}

export function generateDailySudoku(date: string): DailySudoku {
  const difficulty = sudokuDifficultyFor(date);
  const p = generateSudoku(`sudoku:${date}`, difficulty);
  return { date, difficulty: p.difficulty, puzzle: p.puzzle, solution: p.solution };
}

export function generateDailySolitaire(date: string, draw: 1 | 3): DailySolitaire {
  const d = dailyDeal(date, draw);
  return { date, draw, seed: d.seed, state: d.state, solution: d.solution };
}

export function generateDailyFreeCell(date: string): DailyFreeCell {
  const d = dailyFreeCellDeal(date);
  return { date, seed: d.seed, state: d.state, solution: d.solution };
}

export function generateDailyMinesweeper(date: string): DailyMinesweeper {
  return { date, ...dailyBoard(date, MINESWEEPER_DAILY_LEVEL) };
}

export function generateDailyMahjong(date: string): DailyMahjong {
  const d = mahjongDailyDeal(date, MAHJONG_DAILY_LAYOUT);
  return { date, layout: MAHJONG_DAILY_LAYOUT, seed: d.seed, state: d.state, solution: d.solution };
}

/**
 * Spider deals take ~60 ms to find and prove with 1 suit, but ~0.4–2 s and up
 * to ~250 MB with 2 suits, and ~5–16 s and ~0.4–1 GB with 4 suits. A Worker
 * has 128 MB, so only 1-suit deals are generated here; 2- and 4-suit dailies
 * are generated offline by scripts/pregenerate-spider.ts and stored ahead in
 * daily_puzzles (the answers cron alerts when fewer than 30 days remain).
 */
export function generateDailySpider(date: string, suits: SuitCount): DailySpider {
  const d = spiderDailyDeal(date, suits);
  return { date, suits, seed: d.seed, state: d.state, solution: d.solution };
}

/** 1 suit: the stored row, or the same deal regenerated from its seed. */
export async function getDailySpider(date: string): Promise<DailySpider> {
  return (await readRow<DailySpider>("spider-solitaire", date, "suits1")) ?? generateDailySpider(date, 1);
}

/** The stored row only (null if not pre-generated). The only way pages get a 2- or 4-suit deal. */
export async function getStoredDailySpider(date: string, suits: SuitCount): Promise<DailySpider | null> {
  return readRow<DailySpider>("spider-solitaire", date, `suits${suits}`);
}

/** Days ahead (from today) with stored 2- and 4-suit Spider dailies; the answers cron alerts below 30. */
export async function spiderDaysStored(today: string): Promise<number> {
  const row = await first<{ n: number }>(
    "SELECT count(DISTINCT puzzle_date) AS n FROM daily_puzzles WHERE game = 'spider-solitaire' AND variant = 'suits4' AND puzzle_date >= ?",
    today
  );
  return row?.n ?? 0;
}

export async function getDailySudoku(date: string): Promise<DailySudoku> {
  return (await readRow<DailySudoku>("sudoku", date, "")) ?? generateDailySudoku(date);
}

export async function getDailySolitaire(date: string, draw: 1 | 3): Promise<DailySolitaire> {
  return (await readRow<DailySolitaire>("solitaire", date, `draw${draw}`)) ?? generateDailySolitaire(date, draw);
}

export async function getDailyMahjong(date: string): Promise<DailyMahjong> {
  return (await readRow<DailyMahjong>("mahjong", date, MAHJONG_DAILY_LAYOUT)) ?? generateDailyMahjong(date);
}

export async function getDailyFreeCell(date: string): Promise<DailyFreeCell> {
  return (await readRow<DailyFreeCell>("freecell", date, "")) ?? generateDailyFreeCell(date);
}

export async function getDailyMinesweeper(date: string): Promise<DailyMinesweeper> {
  return (await readRow<DailyMinesweeper>("minesweeper", date, MINESWEEPER_DAILY_LEVEL)) ?? generateDailyMinesweeper(date);
}

function generateRow(game: string, date: string, variant: string): object {
  if (game === "sudoku") return generateDailySudoku(date);
  if (game === "minesweeper") return generateDailyMinesweeper(date);
  if (game === "freecell") return generateDailyFreeCell(date);
  if (game === "mahjong") return generateDailyMahjong(date);
  if (game === "spider-solitaire") return generateDailySpider(date, 1);
  return generateDailySolitaire(date, variant === "draw3" ? 3 : 1);
}

/**
 * Store the daily puzzles for `dates` that aren't stored yet. Existing rows are
 * never overwritten. Returns what it wrote.
 */
export async function ensureDailyPuzzles(dates: string[]): Promise<string[]> {
  const wanted = dates.flatMap((date) => [
    { game: "sudoku", date, variant: "" },
    { game: "solitaire", date, variant: "draw1" },
    { game: "solitaire", date, variant: "draw3" },
    { game: "freecell", date, variant: "" },
    { game: "minesweeper", date, variant: MINESWEEPER_DAILY_LEVEL },
    { game: "mahjong", date, variant: MAHJONG_DAILY_LAYOUT },
    // 2- and 4-suit Spider rows come from scripts/pregenerate-spider.ts.
    { game: "spider-solitaire", date, variant: "suits1" },
  ]);
  const existing = await all<{ game: string; puzzle_date: string; variant: string }>(
    `SELECT game, puzzle_date, variant FROM daily_puzzles WHERE puzzle_date IN (${dates.map(() => "?").join(", ")})`,
    ...dates
  );
  const have = new Set(existing.map((r) => `${r.game}|${r.puzzle_date}|${r.variant}`));
  const rows = wanted
    .filter((w) => !have.has(`${w.game}|${w.date}|${w.variant}`))
    .map((w) => ({
      ...w,
      data: generateRow(w.game, w.date, w.variant),
    }));
  if (!rows.length) return [];
  await batch(
    rows.map((r) => [
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
      r.game,
      r.date,
      r.variant,
      JSON.stringify(r.data),
    ])
  );
  return rows.map((r) => `${r.game}${r.variant ? `/${r.variant}` : ""} ${r.date}`);
}
