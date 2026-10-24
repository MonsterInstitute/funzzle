/**
 * Kakuro grid basics. The board is `width × width` cells (row-major), with
 * row 0 and column 0 always black: an `size × size` interior plus the clue
 * border. A black cell holds the sum of the run to its right (across) and/or
 * below it (down). Digits are 1–9 and never repeat inside a run.
 *
 * Candidates are 9-bit masks: bit d-1 set means digit d is still possible.
 */

export const ALL = 0x1ff;
export const bit = (d: number) => 1 << (d - 1);

export function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export function digitsOf(m: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d);
  return out;
}

export const firstDigit = (m: number) => 31 - Math.clz32(m & -m) + 1;

const maskSum = (m: number) => digitsOf(m).reduce((a, b) => a + b, 0);

/** COMBOS[k][s]: masks of k distinct digits adding up to s. */
export const COMBOS: number[][][] = (() => {
  const t: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => [] as number[]));
  for (let m = 1; m <= ALL; m++) t[popcount(m)][maskSum(m)].push(m);
  return t;
})();

export const combosFor = (k: number, sum: number, exclude = 0): number[] =>
  k >= 0 && k <= 9 && sum >= 0 && sum <= 45 ? COMBOS[k][sum].filter((m) => !(m & exclude)) : [];

export type Dir = "across" | "down";

export interface Run {
  id: number;
  dir: Dir;
  /** The black cell holding the clue. */
  clue: number;
  cells: number[];
  sum: number;
}

export interface Board {
  size: number;
  width: number;
  /** width × width, true for white (playable) cells. */
  white: boolean[];
  runs: Run[];
  /** For each white cell: [across run id, down run id]. */
  runOf: [number, number][];
}

/** Runs from a layout (white cells) and the clue sums on black cells. */
export function buildBoard(size: number, white: boolean[], across: number[], down: number[]): Board {
  const width = size + 1;
  const runs: Run[] = [];
  const runOf: [number, number][] = white.map(() => [-1, -1]);
  for (let i = 0; i < width * width; i++) {
    if (white[i]) continue;
    const r = Math.floor(i / width);
    const c = i % width;
    if (c + 1 < width && white[i + 1]) {
      const cells: number[] = [];
      for (let j = i + 1; j % width !== 0 && white[j]; j++) cells.push(j);
      const id = runs.length;
      runs.push({ id, dir: "across", clue: i, cells, sum: across[i] });
      for (const j of cells) runOf[j][0] = id;
    }
    if (r + 1 < width && white[i + width]) {
      const cells: number[] = [];
      for (let j = i + width; j < width * width && white[j]; j += width) cells.push(j);
      const id = runs.length;
      runs.push({ id, dir: "down", clue: i, cells, sum: down[i] });
      for (const j of cells) runOf[j][1] = id;
    }
  }
  return { size, width, white, runs, runOf };
}

/** Clue sums for a filled solution. */
export function cluesFor(size: number, white: boolean[], solution: number[]): { across: number[]; down: number[] } {
  const zero = white.map(() => 0);
  const board = buildBoard(size, white, zero, zero);
  const across = zero.slice();
  const down = zero.slice();
  for (const run of board.runs) {
    const s = run.cells.reduce((a, i) => a + solution[i], 0);
    if (run.dir === "across") across[run.clue] = s;
    else down[run.clue] = s;
  }
  return { across, down };
}

/** Digits used and the sum still needed in a run, given the placed values. */
export function runState(run: Run, values: number[]): { used: number; remaining: number; empty: number[]; repeat: boolean } {
  let used = 0;
  let placed = 0;
  let repeat = false;
  const empty: number[] = [];
  for (const i of run.cells) {
    if (values[i]) {
      if (used & bit(values[i])) repeat = true;
      used |= bit(values[i]);
      placed += values[i];
    } else empty.push(i);
  }
  return { used, remaining: run.sum - placed, empty, repeat };
}

/**
 * Exact analysis of one run: which digits each empty cell can still take in
 * some valid completion of this run alone (distinct digits, the right sum,
 * each digit inside the cell's candidates). Also returns the combinations
 * (digit sets) that still fit. `null` = no completion fits (a contradiction).
 */
export function analyzeRun(run: Run, values: number[], cand: number[]): { possible: Map<number, number>; combos: number[] } | null {
  const { used, remaining, empty, repeat } = runState(run, values);
  if (repeat) return null;
  const possible = new Map<number, number>();
  if (!empty.length) return remaining === 0 ? { possible, combos: [] } : null;
  const k = empty.length;
  const ok = new Array<number>(k).fill(0);
  const combos: number[] = [];
  combo: for (const m of combosFor(k, remaining, used)) {
    let roomy = true;
    for (let p = 0; p < k; p++) {
      const opts = cand[empty[p]] & m;
      if (!opts) continue combo;
      if (opts !== m) roomy = false;
    }
    if (roomy) {
      // Every cell can take every digit of the combo: any order works.
      combos.push(m);
      for (let p = 0; p < k; p++) ok[p] |= m;
      continue;
    }
    // Backward pass: BACK[p][s] marks digit sets s that cells p..k-1 can take, as a stamp.
    const gen = ++stamp;
    BACK[k * 512] = gen;
    let layer = [0];
    for (let p = k - 1; p >= 0; p--) {
      const next: number[] = [];
      const opts = cand[empty[p]] & m;
      for (const s of layer) {
        for (let d = opts & ~s; d; d &= d - 1) {
          const t = s | (d & -d);
          if (BACK[p * 512 + t] !== gen) {
            BACK[p * 512 + t] = gen;
            next.push(t);
          }
        }
      }
      if (!next.length) continue combo;
      layer = next;
    }
    if (BACK[m] !== gen) continue;
    combos.push(m);
    // Forward pass: from each reachable prefix set, which digits can cell p take.
    let front = [0];
    for (let p = 0; p < k; p++) {
      const opts = cand[empty[p]] & m;
      const next: number[] = [];
      const fgen = ++stamp;
      for (const s of front) {
        for (let d = opts & ~s; d; d &= d - 1) {
          const b = d & -d;
          const rest = m & ~s & ~b;
          if (BACK[(p + 1) * 512 + rest] !== gen) continue;
          ok[p] |= b;
          const t = s | b;
          if (SEEN[t] !== fgen) {
            SEEN[t] = fgen;
            next.push(t);
          }
        }
      }
      front = next;
    }
  }
  if (!combos.length) return null;
  for (let p = 0; p < k; p++) possible.set(empty[p], ok[p]);
  return { possible, combos };
}

// Scratch stamps for analyzeRun (reused across calls; single-threaded).
let stamp = 0;
const BACK = new Uint32Array(10 * 512);
const SEEN = new Uint32Array(512);

/** Candidates from the placed values alone: 1–9 minus digits already in either run. */
export function startingCandidates(board: Board, values: number[]): number[] {
  const cand = values.map(() => 0);
  const usedBy = board.runs.map((run) => runState(run, values).used);
  for (let i = 0; i < values.length; i++) {
    if (!board.white[i] || values[i]) continue;
    const [a, d] = board.runOf[i];
    cand[i] = ALL & ~usedBy[a] & ~usedBy[d];
  }
  return cand;
}

/**
 * The easy techniques to a fixpoint, in place: last cells, cells down to one
 * digit, and each run's cells limited to the digits of the combinations that
 * make its sum. False on a contradiction. Much cheaper than exact analysis.
 */
export function weakPropagate(board: Board, values: number[], cand: number[]): boolean {
  const place = (cell: number, digit: number) => {
    values[cell] = digit;
    cand[cell] = 0;
    for (const r of board.runOf[cell]) for (const j of board.runs[r].cells) cand[j] &= ~bit(digit);
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const run of board.runs) {
      const { used, remaining, empty, repeat } = runState(run, values);
      if (repeat) return false;
      if (!empty.length) {
        if (remaining !== 0) return false;
        continue;
      }
      if (empty.length === 1) {
        if (remaining < 1 || remaining > 9 || !(cand[empty[0]] & bit(remaining))) return false;
        place(empty[0], remaining);
        changed = true;
        continue;
      }
      let union = 0;
      for (const m of combosFor(empty.length, remaining, used)) union |= m;
      for (const i of empty) {
        const m = cand[i] & union;
        if (!m) return false;
        if (m !== cand[i]) {
          cand[i] = m;
          changed = true;
        }
      }
    }
    for (let i = 0; i < values.length; i++) {
      if (board.white[i] && !values[i] && popcount(cand[i]) === 1) {
        place(i, firstDigit(cand[i]));
        changed = true;
      }
    }
  }
  return true;
}

/**
 * Exact run analysis on every run to a fixpoint, placing cells that come down
 * to one digit. In place; false on a contradiction. This is as strong as the
 * human solver's full toolkit, just without the bookkeeping.
 */
export function propagateRuns(board: Board, vals: number[], cand: number[]): boolean {
  if (!weakPropagate(board, vals, cand)) return false;
  const queue = board.runs.map((r) => r.id);
  const queued = new Uint8Array(board.runs.length).fill(1);
  while (queue.length) {
    const id = queue.pop()!;
    queued[id] = 0;
    const a = analyzeRun(board.runs[id], vals, cand);
    if (!a) return false;
    for (const [i, m] of a.possible) {
      if (!m) return false;
      if (m === cand[i]) continue;
      cand[i] = m;
      if (popcount(m) === 1) {
        vals[i] = firstDigit(m);
        cand[i] = 0;
      }
      for (const r of board.runOf[i]) {
        if (!queued[r]) {
          queued[r] = 1;
          queue.push(r);
        }
      }
    }
  }
  return true;
}

/** Cells still open after propagation from an empty board (0 = logically solvable). */
export function openCells(board: Board): number {
  const vals = board.white.map(() => 0);
  const cand = startingCandidates(board, vals);
  if (!propagateRuns(board, vals, cand)) return Infinity;
  let open = 0;
  for (let i = 0; i < vals.length; i++) if (board.white[i] && !vals[i]) open++;
  return open;
}

/** Counts solutions up to `limit` (exact: run propagation plus backtracking). */
export function countSolutions(board: Board, values: number[], limit = 2): number {
  let count = 0;
  const rec = (vals: number[], cand: number[]): void => {
    if (!propagateRuns(board, vals, cand)) return;
    let best = -1;
    for (let i = 0; i < vals.length; i++) {
      if (board.white[i] && !vals[i] && (best < 0 || popcount(cand[i]) < popcount(cand[best]))) best = i;
    }
    if (best < 0) {
      count++;
      return;
    }
    for (const d of digitsOf(cand[best])) {
      if (count >= limit) return;
      const v = vals.slice();
      const c = cand.slice();
      v[best] = d;
      c[best] = 0;
      rec(v, c);
    }
  };
  rec(values.slice(), startingCandidates(board, values));
  return count;
}
