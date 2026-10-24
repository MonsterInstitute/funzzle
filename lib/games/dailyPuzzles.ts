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
import { generateNonogram, type Clues } from "@/lib/games/nonogram";
import { generateKakuro, type Difficulty as KakuroDifficulty } from "@/lib/games/kakuro";
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

export interface DailyNonogram {
  date: string;
  size: 10;
  solution: number[];
  clues: Clues;
  /** Hand-drawn picture's name, or null for a generated pattern. */
  name: string | null;
}

export interface DailyKakuro {
  date: string;
  difficulty: KakuroDifficulty;
  size: number;
  layout: string;
  solution: number[];
  across: number[];
  down: number[];
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

export function generateDailyNonogram(date: string): DailyNonogram {
  const p = generateNonogram(`nonogram:${date}`, 10);
  return { date, size: 10, solution: p.solution, clues: p.clues, name: p.name };
}

export function generateDailyKakuro(date: string): DailyKakuro {
  const p = generateKakuro(`kakuro:${date}`, "medium");
  return { date, difficulty: p.difficulty, size: p.size, layout: p.layout, solution: p.solution, across: p.across, down: p.down };
}

export async function getDailyNonogram(date: string): Promise<DailyNonogram> {
  return (await readRow<DailyNonogram>("nonogram", date, "")) ?? generateDailyNonogram(date);
}

export async function getDailyKakuro(date: string): Promise<DailyKakuro> {
  return (await readRow<DailyKakuro>("kakuro", date, "")) ?? generateDailyKakuro(date);
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
    { game: "nonogram", date, variant: "" },
    { game: "kakuro", date, variant: "" },
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
      data:
        w.game === "sudoku"
          ? generateDailySudoku(w.date)
          : w.game === "nonogram"
            ? generateDailyNonogram(w.date)
            : w.game === "kakuro"
              ? generateDailyKakuro(w.date)
              : generateDailySolitaire(w.date, w.variant === "draw3" ? 3 : 1),
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
