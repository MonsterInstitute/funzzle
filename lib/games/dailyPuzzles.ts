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
import { bankPuzzleFor, type GroupsPuzzle } from "@/lib/games/groups";
import { sudokuDifficultyFor, type SudokuDifficulty } from "./dailySchedule";
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

export interface DailyGroups {
  date: string;
  /** "ai": generated and validated by lib/cron/content/groups.ts; "bank": the fallback bank. */
  source: "ai" | "bank";
  puzzle: GroupsPuzzle;
}

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

/**
 * The fallback Groups daily: a bank puzzle picked by date. Groups rows are
 * written by lib/cron/content/groups.ts (not ensureDailyPuzzles), which
 * stores exactly this fallback for any day that is already live without a
 * row, so a page that served it never changes puzzle mid-day.
 */
export function generateDailyGroups(date: string): DailyGroups {
  return { date, source: "bank", puzzle: bankPuzzleFor(date) };
}

export async function getDailyGroups(date: string): Promise<DailyGroups> {
  return (await readRow<DailyGroups>("groups", date, "")) ?? generateDailyGroups(date);
}

export async function getDailySudoku(date: string): Promise<DailySudoku> {
  return (await readRow<DailySudoku>("sudoku", date, "")) ?? generateDailySudoku(date);
}

export async function getDailySolitaire(date: string, draw: 1 | 3): Promise<DailySolitaire> {
  return (await readRow<DailySolitaire>("solitaire", date, `draw${draw}`)) ?? generateDailySolitaire(date, draw);
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
      data: w.game === "sudoku" ? generateDailySudoku(w.date) : generateDailySolitaire(w.date, w.variant === "draw3" ? 3 : 1),
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
