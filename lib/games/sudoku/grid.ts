/**
 * Grid primitives for Sudoku: geometry tables, candidate masks and a fast
 * brute-force solver. Everything here is pure and allocation-light because the
 * generator calls it thousands of times per puzzle.
 *
 * A grid is 81 numbers, row-major, 0 = empty. A candidate mask uses bit d-1
 * for digit d, so the full set is 0x1ff.
 */

export type Grid = number[];

export const ALL_DIGITS = 0x1ff;

export const bit = (digit: number) => 1 << (digit - 1);

export const rowOf = (cell: number) => (cell / 9) | 0;
export const colOf = (cell: number) => cell % 9;
export const boxOf = (cell: number) => ((cell / 27) | 0) * 3 + (((cell % 9) / 3) | 0);

/** Popcount for 9-bit masks via a lookup table (hot in every technique). */
const POP = new Uint8Array(512);
for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
export const popcount = (mask: number) => POP[mask & ALL_DIGITS];

/** Digits (1-9) present in a mask, ascending. */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Lowest digit in a mask (only meaningful for non-empty masks). */
export const firstDigit = (mask: number) => 31 - Math.clz32(mask & -mask) + 1;

export type UnitKind = "row" | "col" | "box";

/** The 27 units: rows 0-8, columns 9-17, boxes 18-26. */
export const UNITS: number[][] = [];
for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3;
  const c0 = (b % 3) * 3;
  UNITS.push(Array.from({ length: 9 }, (_, k) => (r0 + ((k / 3) | 0)) * 9 + c0 + (k % 3)));
}

export const unitRef = (u: number): { kind: UnitKind; index: number } =>
  u < 9 ? { kind: "row", index: u } : u < 18 ? { kind: "col", index: u - 9 } : { kind: "box", index: u - 18 };

/** The 20 peers of each cell (same row, column or box), and an 81x81 lookup. */
export const PEERS: number[][] = [];
export const IS_PEER = new Uint8Array(81 * 81);
for (let i = 0; i < 81; i++) {
  const set = new Set<number>();
  for (const u of [rowOf(i), 9 + colOf(i), 18 + boxOf(i)]) for (const j of UNITS[u]) if (j !== i) set.add(j);
  PEERS.push([...set].sort((a, b) => a - b));
  for (const j of set) IS_PEER[i * 81 + j] = 1;
}

/** Per-cell 9-bit masks of digits that don't clash with the row/column/box (0 for filled cells). */
export function candidates(grid: Grid): number[] {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const d = grid[i];
    if (d) {
      const b = bit(d);
      rows[rowOf(i)] |= b;
      cols[colOf(i)] |= b;
      boxes[boxOf(i)] |= b;
    }
  }
  const out = new Array<number>(81);
  for (let i = 0; i < 81; i++) {
    out[i] = grid[i] ? 0 : ALL_DIGITS & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
  }
  return out;
}

/** Indices (ascending) of filled cells that share a digit with another filled cell in a unit. */
export function conflicts(grid: Grid): number[] {
  const bad = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const d = grid[i];
      if (!d) continue;
      const other = seen.get(d);
      if (other === undefined) seen.set(d, i);
      else {
        bad.add(other);
        bad.add(i);
      }
    }
  }
  return [...bad].sort((a, b) => a - b);
}

export function isSolved(grid: Grid, solution: Grid): boolean {
  for (let i = 0; i < 81; i++) if (grid[i] !== solution[i]) return false;
  return true;
}

/**
 * Bitmask backtracking with minimum-remaining-values cell choice. Calls
 * `onSolution` for each solution found and stops once `limit` are counted.
 */
function search(grid: Grid, limit: number, onSolution?: (cells: Grid) => void): number {
  const cells = grid.slice();
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);
  const empties: number[] = [];
  for (let i = 0; i < 81; i++) {
    const d = cells[i];
    if (!d) {
      empties.push(i);
      continue;
    }
    if (d < 1 || d > 9) return 0;
    const b = bit(d);
    const r = rowOf(i), c = colOf(i), x = boxOf(i);
    if (rows[r] & b || cols[c] & b || boxes[x] & b) return 0;
    rows[r] |= b;
    cols[c] |= b;
    boxes[x] |= b;
  }
  let count = 0;
  const rec = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let k = 0; k < empties.length; k++) {
      const i = empties[k];
      if (cells[i]) continue;
      const m = ALL_DIGITS & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
      const n = POP[m];
      if (n === 0) return false;
      if (n < bestCount) {
        best = i;
        bestMask = m;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best === -1) {
      count++;
      onSolution?.(cells);
      return count >= limit;
    }
    const r = rowOf(best), c = colOf(best), x = boxOf(best);
    let m = bestMask;
    while (m) {
      const b = m & -m;
      m ^= b;
      cells[best] = 31 - Math.clz32(b) + 1;
      rows[r] |= b;
      cols[c] |= b;
      boxes[x] |= b;
      const stop = rec();
      rows[r] &= ~b;
      cols[c] &= ~b;
      boxes[x] &= ~b;
      if (stop) {
        cells[best] = 0;
        return true;
      }
    }
    cells[best] = 0;
    return false;
  };
  rec();
  return count;
}

/** Number of solutions, counting stops at `limit` (2 is enough to test uniqueness). */
export function countSolutions(grid: Grid, limit = 2): number {
  return search(grid, limit);
}

/** First solution found by brute force, or null if there is none. */
export function solve(grid: Grid): Grid | null {
  let found: Grid | null = null;
  search(grid, 1, (cells) => {
    found = cells.slice();
  });
  return found;
}
