/**
 * Minesweeper engine with no-guess boards: rules, a human-style logical
 * solver, seeded generation that only hands out boards the solver can clear
 * from the first click, and the coach's hint ladder. Pure TypeScript with no
 * runtime dependencies, so it runs the same in the browser, a Worker and Node.
 */

export type { Board, BoardSize, Difficulty, GameState, Layout, Snapshot, Status } from "./board";
export {
  DIFFICULTIES,
  SIZES,
  adjacentCounts,
  chord,
  colOf,
  minesLeft,
  neighbors,
  newGame,
  numberAt,
  reveal,
  rowOf,
  toggleFlag,
  undoExplosion,
} from "./board";
export type { Deduction, SolveResult, Technique } from "./solver";
export { TECHNIQUES, nextDeduction, solvableWithoutGuessing, solveLayout } from "./solver";
export { centerCell, dailyBoard, generateBoard, placeMines, transposeBoard } from "./generate";
export type { Hint, HintTechnique } from "./coach";
export { findMistake, hint } from "./coach";
