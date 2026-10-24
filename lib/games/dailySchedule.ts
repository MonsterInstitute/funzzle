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

/** Every daily FreeCell deal is solver-verified; most are a medium-hard think. */
export const FREECELL_PUZZLE_RATING = 1450;
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
/** Mahjong Solitaire by layout: more tiles and taller stacks rate higher. */
export const MAHJONG_PUZZLE_RATING = {
  quick: 1000,
  bridge: 1150,
  fortress: 1250,
  pyramid: 1300,
  turtle: 1400,
} as const;
/** Spider by suit count: one suit is gentle, four is one of the hardest card games. */
export const SPIDER_PUZZLE_RATING = { 1: 1150, 2: 1500, 4: 1900 } as const;
/** Spelling Hive and Letter Box use one daily difficulty. */
export const SPELLING_HIVE_PUZZLE_RATING = 1300;
export const LETTER_BOX_PUZZLE_RATING = 1450;
/** Groups puzzles all aim for the same spread (levels 1–4 on every board). */
export const GROUPS_PUZZLE_RATING = 1400;
/** Daily/practice chess puzzles by difficulty (graded by solution length). */
export const CHESS_PUZZLE_RATING = { easy: 1100, medium: 1450, hard: 1800 } as const;

/** Chess vs the computer: each level's rating as the "opponent". */
export const CHESS_LEVEL_RATING = { 1: 700, 2: 1000, 3: 1300, 4: 1600, 5: 1900, 6: 2200 } as const;
/** Mini Crossword "opponent" ratings: the everyday 5×5 and the Saturday 7×7. */
export const MINI_PUZZLE_RATING: Record<number, number> = { 5: 1100, 7: 1450 };
/** Funzzle Word modes: Quad and Math take more deduction than one word. */
export const WORD_PUZZLE_RATING = { classic: 1250, quad: 1450, geo: 1300, math: 1450 } as const;
/** Word Hunt has no difficulty levels: every theme plays as one "opponent". */
export const WORD_HUNT_PUZZLE_RATING = 1350;
