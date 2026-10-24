/**
 * Nonogram engine: seeded pictures and patterns, an exact line solver that
 * proves every puzzle has one solution, a human-style step solver that names
 * its technique, and the coach's hint ladder. Pure TypeScript, so it runs the
 * same in the browser, a Worker and Node.
 */
export { EMPTY, FILLED, UNKNOWN, analyzeLine, clueOf, type CellState, type LineTechnique } from "./line";
export {
  TECHNIQUES,
  applyStep,
  cluesOf,
  lineCells,
  lineSolvable,
  nextStep,
  propagate,
  solveLogically,
  techniqueLevel,
  type Clues,
  type LineRef,
  type LogicResult,
  type Step,
  type Technique,
} from "./solver";
export { SIZES, generateNonogram, skillsOf, type NonogramPuzzle, type Size } from "./generate";
export { PICTURES, type Picture } from "./pictures";
export { TITLES, clueText, hintLadder, lineName, type HintLadder } from "./coach";
