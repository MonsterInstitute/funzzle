/**
 * Word Hunt board geometry: a 6-column × 8-row letter grid, cells numbered
 * row-major (0 … 47). Words are paths through neighboring cells in any of the
 * eight directions, each cell used once per word. Pure and dependency-free,
 * so the browser, Workers and Node share it.
 */

export const ROWS = 8;
export const COLS = 6;
export const CELLS = ROWS * COLS;

export const rowOf = (i: number) => Math.floor(i / COLS);
export const colOf = (i: number) => i % COLS;
export const cellAt = (r: number, c: number) => r * COLS + c;

/** The eight neighbors of every cell, precomputed. */
export const NEIGHBORS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const r = rowOf(i);
  const c = colOf(i);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(cellAt(rr, cc));
    }
  }
  return out;
});

export function adjacent(a: number, b: number): boolean {
  return a !== b && Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
}

/**
 * A diagonal step lives in one 2×2 block. Two words may not cross there (one
 * using "\" while another uses "/"), so the board never shows an X of lines.
 * Returns [block, 1 for "\" | 2 for "/"], or null for a straight step.
 */
export function diagonalOf(a: number, b: number): [block: number, kind: 1 | 2] | null {
  const ra = rowOf(a);
  const rb = rowOf(b);
  const ca = colOf(a);
  const cb = colOf(b);
  if (ra === rb || ca === cb) return null;
  const block = Math.min(ra, rb) * (COLS - 1) + Math.min(ca, cb);
  return [block, (rb - ra) * (cb - ca) > 0 ? 1 : 2];
}

/** Distinct cells, each a neighbor of the one before. */
export function isPath(path: readonly number[]): boolean {
  if (!path.length) return false;
  const seen = new Set<number>();
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (!Number.isInteger(i) || i < 0 || i >= CELLS || seen.has(i)) return false;
    if (k && !adjacent(path[k - 1], i)) return false;
    seen.add(i);
  }
  return true;
}

export function spell(grid: string, path: readonly number[]): string {
  return path.map((i) => grid[i]).join("");
}

/** Which pairs of opposite sides a path touches. */
export function spanSides(path: readonly number[]): { topBottom: boolean; leftRight: boolean } {
  const rows = path.map(rowOf);
  const cols = path.map(colOf);
  return {
    topBottom: rows.includes(0) && rows.includes(ROWS - 1),
    leftRight: cols.includes(0) && cols.includes(COLS - 1),
  };
}

export function touchesOppositeSides(path: readonly number[]): boolean {
  const s = spanSides(path);
  return s.topBottom || s.leftRight;
}

/**
 * Every way to trace `word` (any case) through the grid as a path, as distinct
 * cell sets, up to `limit`. Used to check a theme word is findable and to
 * prefer grids where it can only be read in one place.
 */
export function tracePaths(grid: string, word: string, limit = 2): number[][] {
  const w = word.toUpperCase();
  const g = grid.toUpperCase();
  const out: number[][] = [];
  const keys = new Set<string>();
  const used = new Uint8Array(CELLS);
  const path: number[] = [];
  const dfs = (i: number): boolean => {
    path.push(i);
    used[i] = 1;
    if (path.length === w.length) {
      const key = [...path].sort((a, b) => a - b).join(",");
      if (!keys.has(key)) {
        keys.add(key);
        out.push([...path]);
      }
    } else {
      const ch = w[path.length];
      for (const n of NEIGHBORS[i]) {
        if (!used[n] && g[n] === ch && dfs(n)) return true;
      }
    }
    used[i] = 0;
    path.pop();
    return out.length >= limit;
  };
  for (let i = 0; i < CELLS && out.length < limit; i++) {
    if (g[i] === w[0] && dfs(i)) break;
  }
  return out;
}

/** The straight lines of the grid (rows, columns, both diagonals), each read both ways. */
export function gridLines(grid: string): string[] {
  const lines: string[] = [];
  const add = (cells: number[]) => {
    if (cells.length < 2) return;
    const s = cells.map((i) => grid[i]).join("");
    lines.push(s, [...s].reverse().join(""));
  };
  for (let r = 0; r < ROWS; r++) add(Array.from({ length: COLS }, (_, c) => cellAt(r, c)));
  for (let c = 0; c < COLS; c++) add(Array.from({ length: ROWS }, (_, r) => cellAt(r, c)));
  for (let d = -(COLS - 1); d < ROWS; d++) {
    const down: number[] = [];
    const up: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const r1 = d + c;
      if (r1 >= 0 && r1 < ROWS) down.push(cellAt(r1, c));
      const r2 = d + (COLS - 1 - c);
      if (r2 >= 0 && r2 < ROWS) up.push(cellAt(r2, c));
    }
    add(down);
    add(up);
  }
  return lines;
}
