/**
 * Mini Crossword grid model, shared by the generator, the cron, the bank and
 * the browser. A puzzle is its solution rows ("#" = black square) plus one
 * clue per entry; numbering and entries are derived from the rows, so the two
 * can never drift apart. Browser-safe: no word lists in here.
 */

export const BLACK = "#";

export type Dir = "A" | "D";

/** One across or down answer. `id` is "1A", "4D", … */
export interface Entry {
  id: string;
  number: number;
  dir: Dir;
  /** Cell indexes (row * size + col), in reading order. */
  cells: number[];
  /** Uppercase answer. */
  answer: string;
}

export interface MiniPuzzle {
  size: number;
  /** Uppercase solution rows; "#" marks a black square. */
  rows: string[];
  /** One clue per entry id ("1A", "2D", …). */
  clues: Record<string, string>;
}

export interface Layout {
  size: number;
  /** Solution letter per cell ("" for black squares). */
  solution: string[];
  black: boolean[];
  /** Clue number per cell (0 = none). */
  numbers: number[];
  across: Entry[];
  down: Entry[];
  /** Across entries, then down entries, in number order. */
  entries: Entry[];
  /** [across entry index or -1, down entry index or -1] per cell, into `entries`. */
  cellEntries: [number, number][];
}

/** Numbering and entries for a grid of rows ("#" = black; letters or "." for open cells). */
export function layoutOf(rows: string[]): Layout {
  const size = rows.length;
  const cellsOf = rows.join("");
  const black = Array.from(cellsOf, (ch) => ch === BLACK);
  const solution = Array.from(cellsOf, (ch) => (ch === BLACK ? "" : ch.toUpperCase()));
  const isOpen = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && !black[r * size + c];
  const numbers = new Array<number>(size * size).fill(0);
  const across: Entry[] = [];
  const down: Entry[] = [];
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isOpen(r, c)) continue;
      const startsA = !isOpen(r, c - 1) && isOpen(r, c + 1);
      const startsD = !isOpen(r - 1, c) && isOpen(r + 1, c);
      if (!startsA && !startsD) continue;
      n++;
      numbers[r * size + c] = n;
      if (startsA) {
        const cells: number[] = [];
        for (let k = c; isOpen(r, k); k++) cells.push(r * size + k);
        across.push({ id: `${n}A`, number: n, dir: "A", cells, answer: cells.map((i) => solution[i]).join("") });
      }
      if (startsD) {
        const cells: number[] = [];
        for (let k = r; isOpen(k, c); k++) cells.push(k * size + c);
        down.push({ id: `${n}D`, number: n, dir: "D", cells, answer: cells.map((i) => solution[i]).join("") });
      }
    }
  }
  const entries = [...across, ...down];
  const cellEntries = Array.from({ length: size * size }, (): [number, number] => [-1, -1]);
  entries.forEach((e, idx) => {
    for (const i of e.cells) cellEntries[i][e.dir === "A" ? 0 : 1] = idx;
  });
  return { size, solution, black, numbers, across, down, entries, cellEntries };
}

/**
 * Structural rules every Mini grid follows: square, 180° rotationally
 * symmetric, every open cell in an across AND a down entry of at least 3
 * letters, and all open cells connected. Returns the problems found.
 */
export function shapeProblems(rows: string[]): string[] {
  const size = rows.length;
  const out: string[] = [];
  if (rows.some((r) => r.length !== size)) return ["grid is not square"];
  const cells = rows.join("");
  const black = (i: number) => cells[i] === BLACK;
  for (let i = 0; i < cells.length; i++) {
    if (black(i) !== black(cells.length - 1 - i)) {
      out.push("black squares are not symmetric");
      break;
    }
  }
  const L = layoutOf(rows);
  for (let i = 0; i < cells.length; i++) {
    if (black(i)) continue;
    const [a, d] = L.cellEntries[i];
    if (a < 0 || d < 0) out.push(`cell ${i} is not in both an across and a down entry`);
  }
  for (const e of L.entries) if (e.cells.length < 3) out.push(`${e.id} is shorter than 3 letters`);
  // Connectivity.
  const start = [...cells].findIndex((ch) => ch !== BLACK);
  if (start >= 0) {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!;
      const r = Math.floor(i / size);
      const c = i % size;
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const rr = r + dr;
        const cc = c + dc;
        const j = rr * size + cc;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size || black(j) || seen.has(j)) continue;
        seen.add(j);
        stack.push(j);
      }
    }
    if (seen.size !== [...cells].filter((ch) => ch !== BLACK).length) out.push("open cells are not connected");
  }
  return out;
}

/** Every line of letters in the grid, both directions (for the blocked-substring check). */
export function gridLines(rows: string[]): string[] {
  const size = rows.length;
  const lines: string[] = [];
  for (let k = 0; k < size; k++) {
    const row = rows[k];
    const col = rows.map((r) => r[k]).join("");
    for (const line of [row, col]) {
      for (const seg of line.split(BLACK)) {
        if (!seg) continue;
        lines.push(seg.toLowerCase(), [...seg].reverse().join("").toLowerCase());
      }
    }
  }
  return lines;
}
