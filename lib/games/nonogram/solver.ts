/**
 * Whole-puzzle logic: rows and columns are solved one line at a time, the way
 * people solve nonograms. `solveLogically` records each step with the
 * technique it needed (for grading, the skill tree and the coach), and
 * `propagate` is the fast exact line solver the generator uses to prove a
 * picture has exactly one solution.
 *
 * Contradiction probing (assume a cell, propagate, find a clash) is the last
 * resort: the generator rejects pictures that need it, but the coach keeps it
 * so it can always explain a way forward.
 */
import { analyzeLine, clueOf, EMPTY, FILLED, LINE_TECHNIQUES, lineStep, UNKNOWN, type LineTechnique } from "./line";

export const TECHNIQUES = [...LINE_TECHNIQUES, "contradiction"] as const;
export type Technique = (typeof TECHNIQUES)[number];
export const techniqueLevel = (t: Technique) => TECHNIQUES.indexOf(t);

export interface Clues {
  rows: number[][];
  cols: number[][];
}

export interface LineRef {
  kind: "row" | "col";
  index: number;
}

export interface Step {
  technique: Technique;
  line: LineRef;
  /** Grid indices (row * size + col). */
  fill: number[];
  empty: number[];
}

/** Clues of a solution grid (1 = filled), square `size`. */
export function cluesOf(solution: ArrayLike<number>, size: number): Clues {
  const rows: number[][] = [];
  const cols: number[][] = [];
  for (let r = 0; r < size; r++) rows.push(clueOf(Array.from({ length: size }, (_, c) => solution[r * size + c])));
  for (let c = 0; c < size; c++) cols.push(clueOf(Array.from({ length: size }, (_, r) => solution[r * size + c])));
  return { rows, cols };
}

export const lineCells = (ref: LineRef, size: number) =>
  Array.from({ length: size }, (_, i) => (ref.kind === "row" ? ref.index * size + i : i * size + ref.index));

const clueFor = (clues: Clues, ref: LineRef) => (ref.kind === "row" ? clues.rows[ref.index] : clues.cols[ref.index]);

function allLines(size: number): LineRef[] {
  const out: LineRef[] = [];
  for (let i = 0; i < size; i++) out.push({ kind: "row", index: i });
  for (let i = 0; i < size; i++) out.push({ kind: "col", index: i });
  return out;
}

/**
 * Exact line solving to a fixpoint, in place. Returns false on a
 * contradiction. Only lines touched by a change are looked at again.
 */
export function propagate(grid: number[], clues: Clues, size: number): boolean {
  const queue: LineRef[] = allLines(size);
  const queued = new Set(queue.map((l) => `${l.kind}${l.index}`));
  while (queue.length) {
    const ref = queue.shift()!;
    queued.delete(`${ref.kind}${ref.index}`);
    const cells = lineCells(ref, size);
    const line = cells.map((i) => grid[i]);
    const a = analyzeLine(clueFor(clues, ref), line);
    if (!a) return false;
    for (let p = 0; p < size; p++) {
      if (line[p] !== UNKNOWN) continue;
      const v = !a.canEmpty[p] ? FILLED : !a.canFill[p] ? EMPTY : UNKNOWN;
      if (v === UNKNOWN) continue;
      grid[cells[p]] = v;
      const cross: LineRef = ref.kind === "row" ? { kind: "col", index: p } : { kind: "row", index: p };
      const key = `${cross.kind}${cross.index}`;
      if (!queued.has(key)) {
        queued.add(key);
        queue.push(cross);
      }
    }
  }
  return true;
}

/** True if exact line solving alone finishes the puzzle (so its solution is unique). */
export function lineSolvable(clues: Clues, size: number): boolean {
  const grid = new Array<number>(size * size).fill(UNKNOWN);
  return propagate(grid, clues, size) && grid.every((v) => v !== UNKNOWN);
}

/** Lines with the most to give first, so hints point at the juiciest line. */
function bestLineStep(grid: number[], clues: Clues, size: number, technique: LineTechnique): Step | null {
  let best: Step | null = null;
  for (const ref of allLines(size)) {
    const cells = lineCells(ref, size);
    const found = lineStep(clueFor(clues, ref), cells.map((i) => grid[i]), technique);
    if (!found) continue;
    const step: Step = {
      technique,
      line: ref,
      fill: found.deduction.fill.map((p) => cells[p]),
      empty: found.deduction.empty.map((p) => cells[p]),
    };
    if (!best || step.fill.length + step.empty.length > best.fill.length + best.empty.length) best = step;
  }
  return best;
}

/** Assume one cell, line-solve, and see whether the puzzle breaks. */
function contradictionStep(grid: number[], clues: Clues, size: number): Step | null {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== UNKNOWN) continue;
    for (const guess of [FILLED, EMPTY]) {
      const trial = grid.slice();
      trial[i] = guess;
      if (!propagate(trial, clues, size)) {
        const v = guess === FILLED ? EMPTY : FILLED;
        return {
          technique: "contradiction",
          line: { kind: "row", index: Math.floor(i / size) },
          fill: v === FILLED ? [i] : [],
          empty: v === EMPTY ? [i] : [],
        };
      }
    }
  }
  return null;
}

/** The easiest next step from this position, or null if solved or stuck. */
export function nextStep(grid: number[], clues: Clues, size: number, allowContradiction = true): Step | null {
  for (const t of LINE_TECHNIQUES) {
    const step = bestLineStep(grid, clues, size, t);
    if (step) return step;
  }
  return allowContradiction ? contradictionStep(grid, clues, size) : null;
}

export function applyStep(grid: number[], step: Step): void {
  for (const i of step.fill) grid[i] = FILLED;
  for (const i of step.empty) grid[i] = EMPTY;
}

export interface LogicResult {
  steps: Step[];
  solved: boolean;
  hardest: Technique | null;
  grid: number[];
}

/** Solves as a person would, recording each step. */
export function solveLogically(clues: Clues, size: number, start?: number[], allowContradiction = false): LogicResult {
  const grid = start ? start.slice() : new Array<number>(size * size).fill(UNKNOWN);
  const steps: Step[] = [];
  let hardest = -1;
  for (;;) {
    const step = nextStep(grid, clues, size, allowContradiction);
    if (!step) break;
    steps.push(step);
    hardest = Math.max(hardest, techniqueLevel(step.technique));
    applyStep(grid, step);
  }
  return { steps, solved: grid.every((v) => v !== UNKNOWN), hardest: hardest < 0 ? null : TECHNIQUES[hardest], grid };
}
