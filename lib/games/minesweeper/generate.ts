/**
 * Seeded no-guess board generation. A board is a pure function of (seed,
 * difficulty, first click), so the daily board needs no storage: every player,
 * the server and the browser build the same one.
 *
 * Approach: scatter the mines with the seeded RNG, keeping the 3x3 around the
 * first click clear so it always opens an area, then run the logical solver
 * from that click. If it would ever need a guess, retry with the derived seed
 * "<seed>:1", "<seed>:2", ... until a layout passes.
 *
 * The daily board always opens at the center cell (see dailyBoard): the
 * first click is part of the puzzle, so it can't be the player's choice.
 */

import { createRng } from "@/lib/games/kit/rng";
import { SIZES, neighbors, type Board, type Difficulty, type Layout } from "./board";
import { solvableWithoutGuessing } from "./solver";

/** Far above what any difficulty needs in practice (expert averages a few dozen). */
export const MAX_ATTEMPTS = 5000;

const attemptSeed = (seed: string, n: number) => (n === 0 ? seed : `${seed}:${n}`);

/** Random layout with no mine on or next to `firstClick`. */
export function placeMines(seed: string, width: number, height: number, mineCount: number, firstClick: number): Layout {
  const size = width * height;
  const clear = new Set([firstClick, ...neighbors(width, height, firstClick)]);
  const pool: number[] = [];
  for (let i = 0; i < size; i++) if (!clear.has(i)) pool.push(i);
  if (mineCount > pool.length) throw new Error("too many mines for the board");
  createRng(seed).shuffle(pool);
  const mines = new Array<boolean>(size).fill(false);
  for (let k = 0; k < mineCount; k++) mines[pool[k]] = true;
  return { width, height, mineCount, mines };
}

/** A board that can be cleared from `firstClick` by logic alone. */
export function generateBoard(seed: string, difficulty: Difficulty, firstClick: number): Board {
  const { width, height, mines } = SIZES[difficulty];
  if (!Number.isInteger(firstClick) || firstClick < 0 || firstClick >= width * height) {
    throw new Error(`first click ${firstClick} is off the ${width}x${height} board`);
  }
  for (let n = 0; n < MAX_ATTEMPTS; n++) {
    const layout = placeMines(attemptSeed(seed, n), width, height, mines, firstClick);
    if (solvableWithoutGuessing(layout, firstClick)) {
      return { ...layout, difficulty, seed, firstClick, attempts: n + 1 };
    }
  }
  // Statistically unreachable; failing loudly beats quietly handing out a board that needs a guess.
  throw new Error(`no no-guess board for ${seed} after ${MAX_ATTEMPTS} attempts`);
}

/** Center cell of a difficulty's board (rounding down on even sizes). */
export function centerCell(difficulty: Difficulty): number {
  const { width, height } = SIZES[difficulty];
  return Math.floor(height / 2) * width + Math.floor(width / 2);
}

/** Swap rows and columns: a no-guess board stays no-guess, since the logic doesn't care about orientation. */
export function transposeBoard(board: Board, difficulty: Difficulty): Board {
  const { width, height } = board;
  const mines = new Array<boolean>(width * height).fill(false);
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) mines[c * height + r] = board.mines[r * width + c];
  const fr = Math.floor(board.firstClick / width);
  const fc = board.firstClick % width;
  return { ...board, difficulty, width: height, height: width, mines, firstClick: fc * height + fr };
}

/**
 * The daily board for a UTC date ("YYYY-MM-DD"). It opens at the center cell,
 * so every player starts from the same position. "expert-mobile" is the
 * day's expert board turned upright, so phone and desktop players share one
 * puzzle (and its results).
 */
export function dailyBoard(date: string, difficulty: Difficulty): Board {
  if (difficulty === "expert-mobile") return transposeBoard(dailyBoard(date, "expert"), "expert-mobile");
  return generateBoard(`minesweeper:${date}:${difficulty}`, difficulty, centerCell(difficulty));
}
