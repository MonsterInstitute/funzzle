/**
 * Daily puzzles: one per game per UTC day, the same for everyone.
 *
 * The stored row in daily_puzzles is the source of truth (written ahead of
 * time by the answers cron and the Daily Content workflow), so a later
 * generator change never swaps a puzzle people are already playing. When the
 * row doesn't exist yet the page generates the same puzzle from the same seed.
 * A database error throws instead: a cached page built from a fallback during
 * an outage could differ from the stored puzzle.
 */
import { generateSudoku, type Grid } from "@/lib/games/sudoku";
import { dailyDeal, type Move, type State } from "@/lib/games/solitaire";
import { sudokuDifficultyFor, type SudokuDifficulty } from "./dailySchedule";
import { createServiceSupabase, hasServiceSupabase } from "@/lib/supabase";

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

async function readRow<T>(game: string, date: string, variant: string): Promise<T | null> {
  if (!hasServiceSupabase) return null;
  const { data, error } = await createServiceSupabase()
    .from("daily_puzzles")
    .select("data")
    .eq("game", game)
    .eq("puzzle_date", date)
    .eq("variant", variant)
    .maybeSingle();
  if (error) throw new Error(`daily_puzzles read ${game} ${date}: ${error.message}`);
  return (data?.data as T) ?? null;
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
  const supabase = createServiceSupabase();
  const wanted = dates.flatMap((date) => [
    { game: "sudoku", date, variant: "" },
    { game: "solitaire", date, variant: "draw1" },
    { game: "solitaire", date, variant: "draw3" },
  ]);
  const { data: existing, error } = await supabase
    .from("daily_puzzles")
    .select("game, puzzle_date, variant")
    .in("puzzle_date", dates);
  if (error) throw new Error(`daily_puzzles list: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => `${r.game}|${r.puzzle_date}|${r.variant}`));
  const rows = wanted
    .filter((w) => !have.has(`${w.game}|${w.date}|${w.variant}`))
    .map((w) => ({
      game: w.game,
      puzzle_date: w.date,
      variant: w.variant,
      data: w.game === "sudoku" ? generateDailySudoku(w.date) : generateDailySolitaire(w.date, w.variant === "draw3" ? 3 : 1),
    }));
  if (!rows.length) return [];
  const { error: insertError } = await supabase
    .from("daily_puzzles")
    .upsert(rows, { onConflict: "game,puzzle_date,variant", ignoreDuplicates: true });
  if (insertError) throw new Error(`daily_puzzles insert: ${insertError.message}`);
  return rows.map((r) => `${r.game}${r.variant ? `/${r.variant}` : ""} ${r.puzzle_date}`);
}
