/**
 * Crossword grids: a square of `size × size` cells stored row by row as one
 * string, "#" for a black square and a-z (or "." in an empty template) for a
 * white one. Entries (slots) are the across and down runs of white squares,
 * numbered American-style: left to right, top to bottom, one number per
 * square that starts an across or a down entry.
 */

export type Direction = "across" | "down";

export interface Entry {
  /** "12A" / "7D": the key clues are stored under. */
  id: string;
  num: number;
  dir: Direction;
  row: number;
  col: number;
  /** Cell indexes (row * size + col), in reading order. */
  cells: number[];
}

export const BLACK = "#";

export const isBlack = (grid: string, i: number) => grid[i] === BLACK;

export function sizeOf(grid: string): number {
  const n = Math.round(Math.sqrt(grid.length));
  if (n * n !== grid.length) throw new Error(`grid of ${grid.length} cells is not square`);
  return n;
}

/** Every entry of length >= 2 (valid grids have none shorter than 3), across first then down, each in number order. */
export function entriesOf(grid: string): Entry[] {
  const size = sizeOf(grid);
  const across: Entry[] = [];
  const down: Entry[] = [];
  let num = 0;
  const white = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size && !isBlack(grid, r * size + c);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!white(r, c)) continue;
      const startsA = !white(r, c - 1) && white(r, c + 1);
      const startsD = !white(r - 1, c) && white(r + 1, c);
      if (!startsA && !startsD) continue;
      num++;
      if (startsA) {
        const cells: number[] = [];
        for (let k = c; white(r, k); k++) cells.push(r * size + k);
        across.push({ id: `${num}A`, num, dir: "across", row: r, col: c, cells });
      }
      if (startsD) {
        const cells: number[] = [];
        for (let k = r; white(k, c); k++) cells.push(k * size + c);
        down.push({ id: `${num}D`, num, dir: "down", row: r, col: c, cells });
      }
    }
  }
  return [...across, ...down];
}

/** Number shown in each cell (0 = none). */
export function cellNumbers(grid: string): number[] {
  const nums = new Array<number>(grid.length).fill(0);
  for (const e of entriesOf(grid)) nums[e.cells[0]] = e.num;
  return nums;
}

/** The letters of an entry in `grid` ("." for an empty square). */
export function entryText(grid: string, e: Entry): string {
  return e.cells.map((i) => grid[i]).join("");
}

/** Problems with a template or filled grid; empty when it is a valid American-style grid. */
export function gridProblems(grid: string): string[] {
  const out: string[] = [];
  let size: number;
  try {
    size = sizeOf(grid);
  } catch (err) {
    return [(err as Error).message];
  }
  const n = grid.length;
  for (let i = 0; i < n; i++) {
    if (isBlack(grid, i) !== isBlack(grid, n - 1 - i)) {
      out.push(`not rotationally symmetric at cell ${i}`);
      break;
    }
  }
  // Every white square must be in an across and a down entry of >= 3 letters
  // (that makes every square checked and every entry at least 3 long).
  const acrossLen = new Array<number>(n).fill(1);
  const downLen = new Array<number>(n).fill(1);
  for (const e of entriesOf(grid)) for (const i of e.cells) (e.dir === "across" ? acrossLen : downLen)[i] = e.cells.length;
  for (let i = 0; i < n; i++) {
    if (isBlack(grid, i)) continue;
    if (acrossLen[i] < 3 || downLen[i] < 3) {
      const which = acrossLen[i] < 3 ? `${acrossLen[i]}-letter across` : `${downLen[i]}-letter down`;
      out.push(`cell ${i} (row ${Math.floor(i / size) + 1}, col ${(i % size) + 1}) is in a ${which} run`);
      break;
    }
  }
  // All white squares connected.
  const start = [...grid].findIndex((ch) => ch !== BLACK);
  if (start < 0) out.push("no white squares");
  else {
    const seen = new Uint8Array(n);
    const stack = [start];
    seen[start] = 1;
    let count = 0;
    while (stack.length) {
      const i = stack.pop()!;
      count++;
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
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const j = rr * size + cc;
        if (!seen[j] && !isBlack(grid, j)) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const whites = [...grid].filter((ch) => ch !== BLACK).length;
    if (count !== whites) out.push("white squares are not all connected");
  }
  return out;
}

/** The template (black squares only) of a filled grid. */
export function templateOf(grid: string): string {
  return grid.replace(/[^#]/g, ".");
}
