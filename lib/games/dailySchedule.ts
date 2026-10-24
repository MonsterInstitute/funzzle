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

/** Minesweeper levels players pick; "expert-mobile" is Expert stood upright, not a level of its own. */
export type MinesweeperLevel = "beginner" | "intermediate" | "expert";

/** The daily board is Intermediate every day: big enough to need real logic, quick enough for a break. */
export const MINESWEEPER_DAILY_LEVEL: MinesweeperLevel = "intermediate";

export const MINESWEEPER_LABEL: Record<MinesweeperLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

/** Puzzle "opponent" ratings for the Funzzle Rating. */
export const MINESWEEPER_PUZZLE_RATING: Record<MinesweeperLevel, number> = {
  beginner: 950,
  intermediate: 1350,
  expert: 1750,
};
