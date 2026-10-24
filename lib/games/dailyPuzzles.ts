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
import { sudokuDifficultyFor, type SudokuDifficulty } from "./dailySchedule";
import { all, batch, first, parseJson } from "@/lib/db";
import { fallbackDailyWordSearch, type WordSearchPuzzle } from "@/lib/games/wordsearch";
import { fallbackDailyCrossword, type CrosswordPuzzle } from "@/lib/games/crossword";

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

/**
 * Word Search and Crossword rows are written by their content jobs
 * (lib/cron/content/wordsearch.ts, crossword.ts: DeepSeek themes / clues,
 * validated in code), not by ensureDailyPuzzles: a bank row written first
 * would block the LLM one. Without a row the page uses the fallback bank,
 * picked by date, so it never shows an empty puzzle.
 */
export interface DailyWordSearch extends WordSearchPuzzle {
  date: string;
  source: "llm" | "bank";
}

export interface DailyCrossword extends CrosswordPuzzle {
  date: string;
  source: "llm" | "bank";
}

export function generateDailyWordSearch(date: string): DailyWordSearch {
  return { date, source: "bank", ...fallbackDailyWordSearch(date) };
}

export function generateDailyCrossword(date: string): DailyCrossword {
  return { date, source: "bank", ...fallbackDailyCrossword(date) };
}

export async function getDailyWordSearch(date: string): Promise<DailyWordSearch> {
  return (await readRow<DailyWordSearch>("word-search", date, "")) ?? generateDailyWordSearch(date);
}

export async function getDailyCrossword(date: string): Promise<DailyCrossword> {
  return (await readRow<DailyCrossword>("crossword", date, "")) ?? generateDailyCrossword(date);
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
