/**
 * Seeded kakuro generation. A puzzle is a pure function of (seed, difficulty):
 * the daily one uses seed "kakuro:YYYY-MM-DD", so the server, the browser and
 * the generation script all agree without storing anything.
 *
 * Approach: a symmetric black-cell pattern (180° rotation) with every run 2+
 * cells long and the white cells connected; a random digit fill with no
 * repeats in any run; clues from the fill. A candidate is kept only if the
 * exact solver finds exactly one solution AND the human-style solver can
 * finish it, then it's graded by the hardest technique it needs.
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { bit, buildBoard, cluesFor, countSolutions, popcount, propagateRuns, startingCandidates, weakPropagate, type Board } from "./grid";
import { solveLogically, techniqueLevel, type LogicResult, type Technique } from "./techniques";

export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

/** Interior size per difficulty (the daily is medium, 8 × 8). */
export const SIZE_OF: Record<Difficulty, number> = { easy: 6, medium: 8, hard: 10 };
/** Longest run allowed per interior size. */
const MAX_RUN: Record<number, number> = { 6: 4, 8: 5, 10: 5 };

export interface KakuroPuzzle {
  seed: string;
  difficulty: Difficulty;
  /** Interior size; the board is (size + 1) × (size + 1) with the clue border. */
  size: number;
  /** Row-major over the whole board: "#" black, "." white. */
  layout: string;
  /** Digits on white cells, 0 on black ones. */
  solution: number[];
  /** Clue sums on black cells (0 = no clue). */
  across: number[];
  down: number[];
  hardest: Technique;
  /** Tier * 1000 + effort within the tier. */
  score: number;
}

/** Shape attempts (most are rejected in microseconds). */
const MAX_ATTEMPTS = 4000;
/** Digit tweaks per fill while climbing toward a unique solution. */
const MAX_CLIMB = 600;
/** Give up on a fill that hasn't improved for this many tweaks (a local minimum). */
const STALL = 120;
/** Solvable puzzles to try before settling for the closest grade. */
const MAX_GRADED = 12;

const rank = (d: Difficulty) => DIFFICULTIES.indexOf(d);

/**
 * Grade from a solver run. Easy: never needs crossing elimination. Medium:
 * needs it, but the easy techniques settle at least 60% of the board first.
 * Hard: crossing elimination carries most of the solve.
 */
export function gradeOf(result: LogicResult, whiteCells: number): Difficulty | null {
  if (!result.solved) return null;
  const firstCrossing = result.steps.findIndex((s) => s.technique === "crossing-elimination");
  if (firstCrossing < 0) return "easy";
  const placedBefore = result.steps.slice(0, firstCrossing).filter((s) => s.placement).length;
  return placedBefore >= whiteCells * EASY_SHARE ? "medium" : "hard";
}

const EASY_SHARE = 0.6;

function effort(result: LogicResult): number {
  let sum = 0;
  for (const s of result.steps) sum += (techniqueLevel(s.technique) + 1) ** 2;
  return Math.min(999, sum);
}

/** Symmetric black-cell pattern; null if it falls apart (too few or disconnected white cells). */
export function makeShape(rng: Rng, size: number): boolean[] | null {
  const W = size + 1;
  const white = Array.from({ length: W * W }, (_, i) => i >= W && i % W !== 0);
  const mirror = (i: number) => {
    const r = Math.floor(i / W);
    const c = i % W;
    return (size + 1 - r) * W + (size + 1 - c);
  };
  const black = (i: number) => {
    white[i] = false;
    white[mirror(i)] = false;
  };
  const interior: number[] = [];
  for (let i = 0; i < W * W; i++) if (white[i]) interior.push(i);
  const seeds = Math.round(interior.length * (0.08 + rng.next() * 0.08));
  for (let n = 0; n < seeds; n++) black(interior[rng.int(interior.length)]);

  const maxRun = MAX_RUN[size] ?? 6;
  for (let pass = 0; pass < 60; pass++) {
    let changed = false;
    // Single cells can't form a run: make them black.
    for (const i of interior) {
      if (!white[i]) continue;
      const h = (white[i - 1] ? 1 : 0) + (i % W < size && white[i + 1] ? 1 : 0);
      const v = (white[i - W] ? 1 : 0) + (i + W < W * W && white[i + W] ? 1 : 0);
      if (h === 0 || v === 0) {
        black(i);
        changed = true;
      }
    }
    // Break runs longer than maxRun somewhere in the middle.
    const board = buildBoard(size, white, white.map(() => 0), white.map(() => 0));
    for (const run of board.runs) {
      if (run.cells.length <= maxRun) continue;
      const len = run.cells.length;
      const p = 2 + rng.int(Math.max(1, len - 4));
      black(run.cells[Math.min(len - 3, p)]);
      changed = true;
      break;
    }
    if (!changed) break;
  }

  const cells = interior.filter((i) => white[i]);
  if (cells.length < interior.length * 0.55) return null;
  // Every run 2+ long, all white cells connected.
  const board = buildBoard(size, white, white.map(() => 0), white.map(() => 0));
  if (board.runs.some((r) => r.cells.length < 2 || r.cells.length > maxRun)) return null;
  if (cells.some((i) => board.runOf[i][0] < 0 || board.runOf[i][1] < 0)) return null;
  // No 2×2 black blobs inside the board: they read as holes, not as a puzzle.
  for (let r = 1; r < size; r++) {
    for (let c = 1; c < size; c++) {
      const i = r * W + c;
      if (!white[i] && !white[i + 1] && !white[i + W] && !white[i + W + 1]) return null;
    }
  }
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j >= 0 && j < W * W && white[j] && !seen.has(j) && Math.abs((j % W) - (i % W)) <= 1) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length ? white : null;
}

/** Random digits with no repeats in any run (backtracking, shuffled digit order). */
function fill(rng: Rng, board: Board): number[] | null {
  const values = board.white.map(() => 0);
  const cells = board.white.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
  const used = board.runs.map(() => 0);
  let budget = 20000;
  const rec = (n: number): boolean => {
    if (n === cells.length) return true;
    if (--budget < 0) return false;
    const i = cells[n];
    const [a, d] = board.runOf[i];
    for (const digit of rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const b = bit(digit);
      if ((used[a] | used[d]) & b) continue;
      values[i] = digit;
      used[a] |= b;
      used[d] |= b;
      if (rec(n + 1)) return true;
      used[a] &= ~b;
      used[d] &= ~b;
    }
    values[i] = 0;
    return false;
  };
  return rec(0) ? values : null;
}

interface Openness {
  /** White cells still unsettled. */
  open: number[];
  /** Candidates left over the open cells: lower is closer to solved. */
  score: number;
}

type Measure = (board: Board) => Openness | null;

/** How far a propagation gets from an empty board (null = contradiction). */
function measureWith(propagate: (b: Board, vals: number[], cand: number[]) => boolean): Measure {
  return (board) => {
    const vals = board.white.map(() => 0);
    const cand = startingCandidates(board, vals);
    if (!propagate(board, vals, cand)) return null;
    const open: number[] = [];
    let score = 0;
    for (let i = 0; i < vals.length; i++) {
      if (!board.white[i] || vals[i]) continue;
      open.push(i);
      score += popcount(cand[i]);
    }
    return { open, score };
  };
}

/** The easy techniques only (no crossing elimination). */
const weakMeasure = measureWith(weakPropagate);
/** Everything the human solver knows (exact run analysis). */
const strongMeasure = measureWith(propagateRuns);

/**
 * Hill-climb a fill: change a digit somewhere `measure` reports as open, and
 * keep the change unless it leaves the board less settled (or breaks
 * `keep`). A random fill almost never has a unique solution; a few hundred
 * tweaks in the unsettled part usually get there. Gives up on a fill that
 * stops improving. Returns how open the board ends up.
 */
function climb(
  rng: Rng,
  size: number,
  white: boolean[],
  shape: Board,
  solution: number[],
  measure: Measure,
  stopAt: number,
  keep: (b: Board) => boolean = () => true
): Openness | null {
  const boardFor = () => {
    const { across, down } = cluesFor(size, white, solution);
    return buildBoard(size, white, across, down);
  };
  let now = measure(boardFor());
  if (!now) return null;
  let lastGain = 0;
  for (let it = 0; it < MAX_CLIMB && now.open.length > stopAt && it - lastGain < STALL; it++) {
    const c = now.open[rng.int(now.open.length)];
    let used = 0;
    for (const r of shape.runOf[c]) for (const j of shape.runs[r].cells) if (j !== c) used |= bit(solution[j]);
    const opts: number[] = [];
    for (let d = 1; d <= 9; d++) if (!(used & bit(d)) && d !== solution[c]) opts.push(d);
    if (!opts.length) continue;
    const old = solution[c];
    solution[c] = opts[rng.int(opts.length)];
    const board = boardFor();
    const next = measure(board);
    if (next && next.score <= now.score && keep(board)) {
      if (next.score < now.score) lastGain = it;
      now = next;
    } else solution[c] = old;
  }
  return now;
}

interface Candidate {
  white: boolean[];
  solution: number[];
  across: number[];
  down: number[];
  grade: Difficulty;
  result: LogicResult;
}

/** Deterministic per (seed, difficulty): attempt 0 uses the seed itself, then `${seed}#${n}`. */
export function generateKakuro(seed: string, difficulty: Difficulty): KakuroPuzzle {
  const size = SIZE_OF[difficulty];
  let best: Candidate | null = null;
  let tries = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(attempt === 0 ? `${seed}|${difficulty}` : `${seed}|${difficulty}#${attempt}`);
    const white = makeShape(rng, size);
    if (!white) continue;
    const zero = white.map(() => 0);
    const shape = buildBoard(size, white, zero, zero);
    const solution = fill(rng, shape);
    if (!solution) continue;
    const whiteCells = white.filter(Boolean).length;
    if (difficulty === "easy") {
      // Straight for a board the easy techniques finish.
      if (climb(rng, size, white, shape, solution, weakMeasure, 0)?.open.length !== 0) continue;
    } else {
      if (climb(rng, size, white, shape, solution, strongMeasure, 0)?.open.length !== 0) continue;
      // Medium: let the easy techniques settle most of the board, keeping it solvable.
      if (difficulty === "medium") {
        const stopAt = Math.max(1, Math.floor(whiteCells * (1 - EASY_SHARE)) - 2);
        climb(rng, size, white, shape, solution, weakMeasure, stopAt, (b) => strongMeasure(b)?.open.length === 0);
      }
    }
    const { across, down } = cluesFor(size, white, solution);
    const board = buildBoard(size, white, across, down);
    const result = solveLogically(board, zero);
    const grade = gradeOf(result, whiteCells);
    // A logical finish already implies one solution; the exact count double-checks it.
    if (!grade || countSolutions(board, zero, 2) !== 1) continue;
    const c: Candidate = { white, solution, across, down, grade, result };
    if (grade === difficulty) return toPuzzle(seed, difficulty, size, c);
    if (!best || Math.abs(rank(grade) - rank(difficulty)) < Math.abs(rank(best.grade) - rank(difficulty))) best = c;
    if (++tries >= MAX_GRADED) break;
  }
  // Better a neighbouring grade than no puzzle.
  if (!best) throw new Error(`kakuro: no puzzle for ${seed}`);
  return toPuzzle(seed, difficulty, size, best);
}

function toPuzzle(seed: string, target: Difficulty, size: number, c: Candidate): KakuroPuzzle {
  return {
    seed,
    difficulty: c.grade === target ? target : c.grade,
    size,
    layout: c.white.map((w) => (w ? "." : "#")).join(""),
    solution: c.solution,
    across: c.across,
    down: c.down,
    hardest: c.result.hardest ?? "last-cell",
    score: rank(c.grade) * 1000 + effort(c.result),
  };
}

/** The playable board for a puzzle. */
export function boardOf(p: Pick<KakuroPuzzle, "size" | "layout" | "across" | "down">): Board {
  return buildBoard(p.size, p.layout.split("").map((ch) => ch === "."), p.across, p.down);
}
