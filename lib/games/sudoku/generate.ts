/**
 * Seeded puzzle generation. A puzzle is a pure function of (seed, difficulty):
 * the daily puzzle uses seed "sudoku:YYYY-MM-DD" so every player, the server
 * and the browser all agree without storing anything.
 *
 * Approach: random full solution, then remove clues in a seeded symmetric
 * order, keeping a removal only if the logical solver can still finish the
 * puzzle without exceeding the target grade. A logical finish implies a unique
 * solution, so no separate uniqueness search is needed while digging. If the
 * end result misses the target grade, retry with a derived seed.
 */

import { createRng, type Rng } from "@/lib/games/kit/rng";
import { bit, boxOf, colOf, rowOf, type Grid } from "./grid";
import { runLogic, techniqueLevel, type LogicResult, type Technique } from "./techniques";

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

export interface Puzzle {
  seed: string;
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  givens: number;
  hardest: Technique;
  /** Tier * 1000 + effort within the tier, so it always orders by difficulty first. */
  score: number;
}

/** Allowed clue counts per grade (inclusive). */
export const GIVENS_RANGE: Record<Difficulty, [number, number]> = {
  easy: [36, 45],
  medium: [30, 36],
  hard: [26, 32],
  expert: [17, 28],
};

/** Hardest technique level the solver may use while digging for each grade. */
const MAX_LEVEL: Record<Difficulty, number> = {
  easy: techniqueLevel("hidden-single"),
  medium: techniqueLevel("hidden-pair"),
  hard: techniqueLevel("hidden-triple"),
  expert: techniqueLevel("xy-wing"),
};

/** Enough for every grade in practice; past this we return the closest grade found. */
const MAX_ATTEMPTS = 300;

const rank = (d: Difficulty) => DIFFICULTIES.indexOf(d);

const MEDIUM_LOW = techniqueLevel("pointing");
const MEDIUM_HIGH = techniqueLevel("hidden-pair");
const TRIPLE_LOW = techniqueLevel("naked-triple");
const EXPERT_LOW = techniqueLevel("x-wing");

/** Grade from a solver run: hardest technique, plus "two different medium tricks" counts as hard. */
export function gradeOf(result: LogicResult): Difficulty | null {
  if (!result.solved) return null;
  let max = -1;
  const medium = new Set<Technique>();
  for (const step of result.steps) {
    const level = techniqueLevel(step.technique);
    if (level > max) max = level;
    if (level >= MEDIUM_LOW && level <= MEDIUM_HIGH) medium.add(step.technique);
  }
  if (max >= EXPERT_LOW) return "expert";
  if (max >= TRIPLE_LOW || medium.size >= 2) return "hard";
  if (medium.size === 1) return "medium";
  return "easy";
}

/** Rough human effort: harder techniques weigh quadratically more. */
function effort(result: LogicResult): number {
  let sum = 0;
  for (const step of result.steps) sum += (techniqueLevel(step.technique) + 1) ** 2;
  return Math.min(999, sum);
}

/** Random complete grid: in-order backtracking with a shuffled digit order per cell. */
function randomSolution(rng: Rng): Grid {
  const cells = new Array<number>(81).fill(0);
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);
  const rec = (i: number): boolean => {
    if (i === 81) return true;
    const r = rowOf(i), c = colOf(i), x = boxOf(i);
    const used = rows[r] | cols[c] | boxes[x];
    for (const d of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const b = bit(d);
      if (used & b) continue;
      cells[i] = d;
      rows[r] |= b;
      cols[c] |= b;
      boxes[x] |= b;
      if (rec(i + 1)) return true;
      rows[r] &= ~b;
      cols[c] &= ~b;
      boxes[x] &= ~b;
    }
    cells[i] = 0;
    return false;
  };
  rec(0);
  return cells;
}

interface Candidate {
  puzzle: Grid;
  solution: Grid;
  givens: number;
  grade: Difficulty;
  result: LogicResult;
}

/** One dig from a fresh solution; the grade never exceeds the target by construction. */
function dig(rng: Rng, target: Difficulty): Candidate {
  const solution = randomSolution(rng);
  const puzzle = solution.slice();
  // 180-degree rotational symmetry: pair each cell with its mirror, centre alone.
  const groups: number[][] = [];
  for (let i = 0; i < 40; i++) groups.push([i, 80 - i]);
  groups.push([40]);
  rng.shuffle(groups);

  const floor = GIVENS_RANGE[target][0];
  const maxLevel = MAX_LEVEL[target];
  let givens = 81;
  let result = runLogic(puzzle, maxLevel);
  let grade: Difficulty = "easy";
  for (const group of groups) {
    if (givens - group.length < floor) continue;
    for (const i of group) puzzle[i] = 0;
    const trial = runLogic(puzzle, maxLevel);
    const g = gradeOf(trial);
    if (g && rank(g) <= rank(target)) {
      givens -= group.length;
      result = trial;
      grade = g;
    } else {
      for (const i of group) puzzle[i] = solution[i];
    }
  }
  return { puzzle, solution, givens, grade, result };
}

const fits = (c: Candidate, target: Difficulty) => {
  const [lo, hi] = GIVENS_RANGE[target];
  return c.grade === target && c.givens >= lo && c.givens <= hi;
};

/** Deterministic per (seed, difficulty): attempt 0 uses the seed itself, then `${seed}#${n}`. */
export function generateSudoku(seed: string, difficulty: Difficulty): Puzzle {
  let best: Candidate | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(attempt === 0 ? `${seed}|${difficulty}` : `${seed}|${difficulty}#${attempt}`);
    const c = dig(rng, difficulty);
    if (fits(c, difficulty)) return toPuzzle(seed, c);
    if (!best || rank(c.grade) > rank(best.grade)) best = c;
  }
  // Practically unreachable; better a slightly easier puzzle than no daily puzzle.
  return toPuzzle(seed, best!);
}

function toPuzzle(seed: string, c: Candidate): Puzzle {
  return {
    seed,
    difficulty: c.grade,
    puzzle: c.puzzle,
    solution: c.solution,
    givens: c.givens,
    hardest: c.result.hardest ?? "naked-single",
    score: rank(c.grade) * 1000 + effort(c.result),
  };
}
