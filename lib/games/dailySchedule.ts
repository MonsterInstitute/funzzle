/**
 * Which difficulty the daily puzzles use on a given UTC date. Gentle at the
 * start of the week, hardest on Saturday, like most daily puzzle columns.
 */
export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";

const SUDOKU_BY_WEEKDAY: SudokuDifficulty[] = [
  "medium", // Sun
  "easy", // Mon
  "medium", // Tue
  "medium", // Wed
  "hard", // Thu
  "hard", // Fri
  "expert", // Sat
];

export function sudokuDifficultyFor(date: string): SudokuDifficulty {
  return SUDOKU_BY_WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

export const DIFFICULTY_LABEL: Record<SudokuDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

/** Puzzle "opponent" ratings for the Elo-style Funzzle Rating. */
export const SUDOKU_PUZZLE_RATING: Record<SudokuDifficulty, number> = {
  easy: 1000,
  medium: 1300,
  hard: 1600,
  expert: 1900,
};

export const SOLITAIRE_PUZZLE_RATING = { 1: 1250, 3: 1550 } as const;

/** Nonogram by grid size (the daily is always 10 × 10). */
export const NONOGRAM_PUZZLE_RATING = { 5: 900, 10: 1250, 15: 1600 } as const;

/** Kakuro by grade (easy 6 × 6, medium 8 × 8, hard 10 × 10; the daily is medium). */
export const KAKURO_PUZZLE_RATING = { easy: 1100, medium: 1400, hard: 1700 } as const;
