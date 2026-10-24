/**
 * One line (a row or a column) of a nonogram: its clue, and what the clue
 * proves about the line's unknown cells.
 *
 * `analyzeLine` is the exact line solver: it finds every cell that is filled
 * (or empty) in all placements of the clue's blocks that agree with the cells
 * already known. The named techniques below are weaker, human-sized slices of
 * it, tried easiest first so the coach can say which rule a deduction needs.
 * Every technique is sound, so a puzzle the line solver finishes has exactly
 * one solution.
 */

export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;
export type CellState = 0 | 1 | 2;

/** The block lengths of a line of filled cells ([] for an empty line). */
export function clueOf(cells: ArrayLike<number>, filled = FILLED): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === filled) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

export interface LineAnalysis {
  /** Cell can be filled in at least one valid placement. */
  canFill: boolean[];
  /** Cell can be empty in at least one valid placement. */
  canEmpty: boolean[];
  /** Leftmost and rightmost valid start of each block. */
  minStart: number[];
  maxStart: number[];
}

/**
 * Exact line analysis by dynamic programming in O(blocks × length). Null if no
 * placement of the clue agrees with the known cells (a contradiction).
 */
export function analyzeLine(clue: readonly number[], line: ArrayLike<number>): LineAnalysis | null {
  const n = line.length;
  const k = clue.length;
  const W = n + 1;
  // free[i]: consecutive non-EMPTY cells starting at i; back[i]: ending at i - 1.
  const free = new Int32Array(n + 1);
  for (let i = n - 1; i >= 0; i--) free[i] = line[i] === EMPTY ? 0 : free[i + 1] + 1;
  const back = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) back[i] = line[i - 1] === EMPTY ? 0 : back[i - 1] + 1;

  // S[j][i]: blocks j..k-1 fit in cells [i, n).
  const S = new Uint8Array((k + 1) * W);
  S[k * W + n] = 1;
  for (let i = n - 1; i >= 0; i--) S[k * W + i] = S[k * W + i + 1] && line[i] !== FILLED ? 1 : 0;
  for (let j = k - 1; j >= 0; j--) {
    const b = clue[j];
    for (let i = n - 1; i >= 0; i--) {
      let v = line[i] !== FILLED && S[j * W + i + 1] === 1;
      if (!v && free[i] >= b) {
        const e = i + b;
        v = e === n ? j === k - 1 : line[e] !== FILLED && S[(j + 1) * W + e + 1] === 1;
      }
      S[j * W + i] = v ? 1 : 0;
    }
  }
  if (!S[0]) return null;

  // P[j][i]: blocks 0..j-1 fit in cells [0, i).
  const P = new Uint8Array((k + 1) * W);
  P[0] = 1;
  for (let i = 1; i <= n; i++) P[i] = P[i - 1] && line[i - 1] !== FILLED ? 1 : 0;
  for (let j = 1; j <= k; j++) {
    const b = clue[j - 1];
    for (let i = 1; i <= n; i++) {
      let v = line[i - 1] !== FILLED && P[j * W + i - 1] === 1;
      if (!v && back[i] >= b) {
        const s = i - b;
        v = s === 0 ? j === 1 : line[s - 1] !== FILLED && P[(j - 1) * W + s - 1] === 1;
      }
      P[j * W + i] = v ? 1 : 0;
    }
  }

  const cover = new Int32Array(n + 1);
  const minStart: number[] = [];
  const maxStart: number[] = [];
  for (let j = 0; j < k; j++) {
    const b = clue[j];
    let lo = -1;
    let hi = -1;
    for (let s = 0; s + b <= n; s++) {
      if (free[s] < b) continue;
      if (s === 0 ? j !== 0 : line[s - 1] === FILLED || !P[j * W + s - 1]) continue;
      const e = s + b;
      if (e === n ? j !== k - 1 : line[e] === FILLED || !S[(j + 1) * W + e + 1]) continue;
      if (lo < 0) lo = s;
      hi = s;
      cover[s]++;
      cover[e]--;
    }
    minStart.push(lo);
    maxStart.push(hi);
  }
  const canFill: boolean[] = [];
  const canEmpty: boolean[] = [];
  let run = 0;
  for (let c = 0; c < n; c++) {
    run += cover[c];
    canFill.push(run > 0);
    let empty = false;
    if (line[c] !== FILLED) {
      for (let j = 0; j <= k && !empty; j++) empty = P[j * W + c] === 1 && S[j * W + c + 1] === 1;
    }
    canEmpty.push(empty);
  }
  return { canFill, canEmpty, minStart, maxStart };
}

/** Line techniques, easiest first. The solver always tries them in this order. */
export const LINE_TECHNIQUES = ["simple-boxes", "simple-spaces", "edge-logic", "forcing"] as const;
export type LineTechnique = (typeof LINE_TECHNIQUES)[number];

export interface LineDeduction {
  /** Positions within the line. */
  fill: number[];
  empty: number[];
}

const unknownAt = (line: ArrayLike<number>, i: number) => line[i] === UNKNOWN;

/**
 * Overlap ("simple boxes"): pack the blocks to the left, then to the right, on
 * a blank line. A block's two packings overlap in cells it covers either way.
 * Uses only the clue and the line length.
 */
function simpleBoxes(clue: readonly number[], line: ArrayLike<number>): LineDeduction {
  const n = line.length;
  const fill: number[] = [];
  const total = clue.reduce((a, b) => a + b, 0) + Math.max(0, clue.length - 1);
  const slack = n - total;
  let left = 0;
  for (const b of clue) {
    // Leftmost start `left`, rightmost start `left + slack`.
    for (let c = left + slack; c < left + b; c++) if (unknownAt(line, c)) fill.push(c);
    left += b + 1;
  }
  return { fill, empty: [] };
}

/**
 * Simple spaces: a 0 clue, or cells that no block can reach once the known
 * cells are taken into account (including a finished line's leftovers).
 */
function simpleSpaces(clue: readonly number[], line: ArrayLike<number>, a: LineAnalysis): LineDeduction {
  const n = line.length;
  const reach = new Array<boolean>(n).fill(false);
  clue.forEach((b, j) => {
    for (let c = a.minStart[j]; c < a.maxStart[j] + b; c++) reach[c] = true;
  });
  const empty: number[] = [];
  for (let c = 0; c < n; c++) if (!reach[c] && unknownAt(line, c)) empty.push(c);
  return { fill: [], empty };
}

/**
 * Edge logic (glue): the same overlap as simple boxes, but with each block
 * pushed as far as the known cells allow. A filled cell near an edge or a
 * crossed-out cell stops a block from sliding, so it covers more for sure.
 */
function edgeLogic(clue: readonly number[], line: ArrayLike<number>, a: LineAnalysis): LineDeduction {
  const fill = new Set<number>();
  clue.forEach((b, j) => {
    for (let c = a.maxStart[j]; c < a.minStart[j] + b; c++) if (unknownAt(line, c)) fill.add(c);
  });
  return { fill: [...fill].sort((x, y) => x - y), empty: [] };
}

/** Forcing: try every placement that fits; cells that come out the same every time. */
function forcing(line: ArrayLike<number>, a: LineAnalysis): LineDeduction {
  const fill: number[] = [];
  const empty: number[] = [];
  for (let c = 0; c < line.length; c++) {
    if (!unknownAt(line, c)) continue;
    if (!a.canEmpty[c]) fill.push(c);
    else if (!a.canFill[c]) empty.push(c);
  }
  return { fill, empty };
}

/**
 * The easiest technique that proves something new about this line, or null
 * if the line has nothing left to give. Throws on a contradiction, which only
 * happens if the known cells disagree with the clue.
 */
export function lineStep(
  clue: readonly number[],
  line: ArrayLike<number>,
  only?: LineTechnique
): { technique: LineTechnique; deduction: LineDeduction } | null {
  const a = analyzeLine(clue, line);
  if (!a) throw new Error("contradiction");
  const tries: [LineTechnique, () => LineDeduction][] = [
    ["simple-boxes", () => simpleBoxes(clue, line)],
    ["simple-spaces", () => simpleSpaces(clue, line, a)],
    ["edge-logic", () => edgeLogic(clue, line, a)],
    ["forcing", () => forcing(line, a)],
  ];
  for (const [technique, run] of tries) {
    if (only && technique !== only) continue;
    const deduction = run();
    if (deduction.fill.length || deduction.empty.length) return { technique, deduction };
  }
  return null;
}
