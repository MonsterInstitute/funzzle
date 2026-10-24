/**
 * Human-style kakuro solver. Each finder looks for one technique on the
 * current candidate masks and returns a Step that explains itself, so the
 * coach can put it into words and the generator can grade puzzles by the
 * hardest technique they need. Every technique is sound, so a puzzle the
 * solver finishes has only one solution.
 */
import { analyzeRun, bit, combosFor, digitsOf, firstDigit, popcount, runState, startingCandidates, weakPropagate, type Board } from "./grid";

/** Ordered from easiest to hardest; the solver always tries them in this order. */
export const TECHNIQUES = ["last-cell", "intersection", "unique-sum", "sum-combos", "crossing-elimination"] as const;
export type Technique = (typeof TECHNIQUES)[number];
export const techniqueLevel = (t: Technique) => TECHNIQUES.indexOf(t);

export interface Step {
  technique: Technique;
  placement?: { cell: number; digit: number };
  eliminations: { cell: number; digit: number }[];
  /** Runs the step reasons about (the first is the main one). */
  runs: number[];
  /** Digit sets (masks) the explanation names: the combination(s) that fit. */
  combos: number[];
  focusCells: number[];
}

type Finder = (board: Board, values: number[], cand: number[]) => Step | null;

const lastCell: Finder = (board, values, cand) => {
  for (const run of board.runs) {
    const { remaining, empty } = runState(run, values);
    if (empty.length !== 1) continue;
    const cell = empty[0];
    if (remaining < 1 || remaining > 9 || !(cand[cell] & bit(remaining))) continue;
    return { technique: "last-cell", placement: { cell, digit: remaining }, eliminations: [], runs: [run.id], combos: [], focusCells: [cell] };
  }
  return null;
};

const intersection: Finder = (board, values, cand) => {
  for (let i = 0; i < values.length; i++) {
    if (!board.white[i] || values[i] || popcount(cand[i]) !== 1) continue;
    return { technique: "intersection", placement: { cell: i, digit: firstDigit(cand[i]) }, eliminations: [], runs: [...board.runOf[i]], combos: [], focusCells: [i] };
  }
  return null;
};

function restrictTo(board: Board, values: number[], cand: number[], technique: Technique, oneCombo: boolean): Step | null {
  for (const run of board.runs) {
    const { used, remaining, empty } = runState(run, values);
    if (empty.length < 2) continue;
    const combos = combosFor(empty.length, remaining, used);
    if (!combos.length || (oneCombo && combos.length !== 1)) continue;
    const union = combos.reduce((a, m) => a | m, 0);
    const eliminations: Step["eliminations"] = [];
    for (const i of empty) for (const d of digitsOf(cand[i] & ~union)) eliminations.push({ cell: i, digit: d });
    if (eliminations.length) return { technique, eliminations, runs: [run.id], combos, focusCells: empty };
  }
  return null;
}

/** A sum with one way to make it (3 in two cells = 1 + 2): its cells use only those digits. */
const uniqueSum: Finder = (board, values, cand) => restrictTo(board, values, cand, "unique-sum", true);

/** List the ways to make a sum; digits in none of them are out (10 in two cells never uses 5). */
const sumCombos: Finder = (board, values, cand) => restrictTo(board, values, cand, "sum-combos", false);

/**
 * Check each combination against what the crossing runs allow: combos that
 * can't be placed drop out, and so do digits that fit no remaining placement.
 */
const crossingElimination: Finder = (board, values, cand) => {
  for (const run of board.runs) {
    const a = analyzeRun(run, values, cand);
    if (!a) continue;
    const eliminations: Step["eliminations"] = [];
    for (const [i, m] of a.possible) for (const d of digitsOf(cand[i] & ~m)) eliminations.push({ cell: i, digit: d });
    if (eliminations.length) {
      // Which crossing cells narrowed it: the run's cells with fewer than all options.
      const { empty } = runState(run, values);
      return { technique: "crossing-elimination", eliminations, runs: [run.id], combos: a.combos, focusCells: empty };
    }
  }
  return null;
};

const FINDERS: Finder[] = [lastCell, intersection, uniqueSum, sumCombos, crossingElimination];

/** Easiest step from these candidates, or null if stuck (or a cell has no candidates left). */
export function findStep(board: Board, values: number[], cand: number[], maxLevel = FINDERS.length - 1): Step | null {
  for (let i = 0; i < values.length; i++) if (board.white[i] && !values[i] && !cand[i]) return null;
  for (let level = 0; level <= maxLevel; level++) {
    const step = FINDERS[level](board, values, cand);
    if (step) return step;
  }
  return null;
}

export function applyStep(board: Board, values: number[], cand: number[], step: Step): void {
  if (step.placement) {
    const { cell, digit } = step.placement;
    values[cell] = digit;
    cand[cell] = 0;
    for (const r of board.runOf[cell]) for (const j of board.runs[r].cells) cand[j] &= ~bit(digit);
  }
  for (const { cell, digit } of step.eliminations) cand[cell] &= ~bit(digit);
}

export interface LogicResult {
  steps: Step[];
  solved: boolean;
  hardest: Technique | null;
  values: number[];
}

/** Solves as a person would from these values, recording each step. */
export function solveLogically(board: Board, start: number[]): LogicResult {
  const values = start.slice();
  const cand = startingCandidates(board, values);
  const steps: Step[] = [];
  let hardest = -1;
  for (let n = 0; n < 5000; n++) {
    const step = findStep(board, values, cand);
    if (!step) break;
    steps.push(step);
    hardest = Math.max(hardest, techniqueLevel(step.technique));
    applyStep(board, values, cand, step);
  }
  const solved = values.every((v, i) => !board.white[i] || v > 0);
  return { steps, solved, hardest: hardest < 0 ? null : TECHNIQUES[hardest], values };
}

/**
 * Cells still open after the easy techniques alone (last cell, intersection,
 * unique sums and plain sum combinations, no crossing elimination), from an
 * empty board. Null on a contradiction. Cheap: the generator calls it often.
 */
export function weakOpenCells(board: Board): number[] | null {
  const values = board.white.map(() => 0);
  if (!weakPropagate(board, values, startingCandidates(board, values))) return null;
  return values.map((v, i) => (board.white[i] && !v ? i : -1)).filter((i) => i >= 0);
}
