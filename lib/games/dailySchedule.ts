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

/** Spider by suit count: one suit is gentle, four is one of the hardest card games. */
export const SPIDER_PUZZLE_RATING = { 1: 1150, 2: 1500, 4: 1900 } as const;
