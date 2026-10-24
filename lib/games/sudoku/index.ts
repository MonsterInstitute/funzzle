/**
 * Sudoku engine: seeded generation, brute-force and human-style solvers, and
 * the coach's hint ladder. Pure TypeScript with no runtime dependencies, so it
 * runs the same in the browser, a Worker and Node.
 */

export type { Grid } from "./grid";
export { candidates, conflicts, countSolutions, isSolved, solve } from "./grid";
export type { Step, Technique } from "./techniques";
export { TECHNIQUES, nextStep, solveLogically } from "./techniques";
export type { Difficulty, Puzzle } from "./generate";
export { DIFFICULTIES, GIVENS_RANGE, generateSudoku, gradeOf } from "./generate";
export type { HintLadder } from "./coach";
export { hintLadder } from "./coach";
