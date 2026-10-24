/**
 * Kakuro engine: seeded symmetric boards, an exact solution counter, a
 * human-style solver that names its technique (for grading, skills and the
 * coach), and the coach's hint ladder. Pure TypeScript with no runtime
 * dependencies, so it runs the same in the browser, a Worker and Node.
 */
export {
  ALL,
  COMBOS,
  analyzeRun,
  bit,
  buildBoard,
  cluesFor,
  combosFor,
  countSolutions,
  digitsOf,
  propagateRuns,
  runState,
  startingCandidates,
  weakPropagate,
  type Board,
  type Dir,
  type Run,
} from "./grid";
export { TECHNIQUES, applyStep, findStep, solveLogically, techniqueLevel, weakOpenCells, type LogicResult, type Step, type Technique } from "./techniques";
export { DIFFICULTIES, SIZE_OF, boardOf, generateKakuro, gradeOf, makeShape, type Difficulty, type KakuroPuzzle } from "./generate";
export { TITLES, cellName, comboText, combosLine, hintLadder, runName, type HintLadder } from "./coach";
