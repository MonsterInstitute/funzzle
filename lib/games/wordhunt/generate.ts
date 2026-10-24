/**
 * Word Hunt grid generator. Given a theme (a span word plus 5–8 theme words,
 * 48 letters in all) it lays every word along a path of neighboring cells so
 * that the paths tile the whole 6 × 8 board, never cross each other, and the
 * span word touches two opposite sides.
 *
 * Geometry first, letters last: the board is cut into paths of the right
 * lengths, then each word is written along its path (forwards or backwards).
 *
 *   1. The span word: a random walk that starts on one side and must reach
 *      the opposite one (left↔right, or top↔bottom when it is ≥ 8 long).
 *   2. Every other word starts at the most cornered free cell (fewest free
 *      neighbors) — the cell that is hardest to cover later — and walks from
 *      there. After each word the free cells must still split into regions
 *      whose sizes the remaining word lengths can fill exactly.
 *   3. Randomized backtracking with a node budget and restarts. Several
 *      tilings are built and the best one kept: words that bend (not straight
 *      lines), each theme word readable in only one place, no blocked strings
 *      in any row, column or diagonal (both directions).
 *
 * Deterministic per seed (lib/games/kit/rng).
 */
import { createRng, type Rng } from "@/lib/games/kit/rng";
import { containsBlockedSubstring } from "@/lib/games/words/blocklist";
import { CELLS, COLS, NEIGHBORS, ROWS, colOf, diagonalOf, gridLines, rowOf, tracePaths, touchesOppositeSides } from "./grid";
import type { PlacedWord, WordHuntTheme } from "./types";

export const MIN_WORDS = 5;
export const MAX_WORDS = 8;
export const WORD_LENGTH: [number, number] = [4, 12];
export const SPAN_LENGTH: [number, number] = [6, 12];

export class TilingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TilingError";
  }
}

/** Shape problems that make a theme impossible to lay out (dictionary checks live in validate.ts). */
export function shapeProblems(theme: Pick<WordHuntTheme, "span" | "words">): string[] {
  const out: string[] = [];
  const all = [theme.span, ...theme.words];
  if (theme.words.length < MIN_WORDS || theme.words.length > MAX_WORDS) out.push(`needs ${MIN_WORDS}–${MAX_WORDS} theme words besides the span word, got ${theme.words.length}`);
  for (const w of all) if (!/^[a-z]+$/i.test(w)) out.push(`"${w}" must be letters only`);
  if (theme.span.length < SPAN_LENGTH[0] || theme.span.length > SPAN_LENGTH[1]) out.push(`span word "${theme.span}" must be ${SPAN_LENGTH[0]}–${SPAN_LENGTH[1]} letters`);
  for (const w of theme.words) if (w.length < WORD_LENGTH[0] || w.length > WORD_LENGTH[1]) out.push(`"${w}" must be ${WORD_LENGTH[0]}–${WORD_LENGTH[1]} letters`);
  const total = all.reduce((n, w) => n + w.length, 0);
  if (total !== CELLS) out.push(`the words have ${total} letters; the board needs exactly ${CELLS}`);
  const upper = all.map((w) => w.toUpperCase());
  if (new Set(upper).size !== upper.length) out.push("words must be distinct");
  return out;
}

// ---------------------------------------------------------------------------
// Board state
// ---------------------------------------------------------------------------

const FREE = -1;
const BLOCKS = (ROWS - 1) * (COLS - 1);

/** For each cell and neighbor slot: the 2×2 block and kind of a diagonal step (kind 0 = straight). */
const STEP_BLOCK: number[][] = NEIGHBORS.map((ns, a) => ns.map((n) => diagonalOf(a, n)?.[0] ?? -1));
const STEP_KIND: number[][] = NEIGHBORS.map((ns, a) => ns.map((n) => diagonalOf(a, n)?.[1] ?? 0));

class Board {
  owner = new Int8Array(CELLS).fill(FREE);
  diag = new Uint8Array(BLOCKS);
  nodes = 0;
  constructor(readonly budget: number) {}

  /** Can a path step from a to its k-th neighbor without crossing a used diagonal? */
  open(a: number, k: number): boolean {
    const b = STEP_BLOCK[a][k];
    return b < 0 || this.diag[b] === 0;
  }

  freeDegree(i: number): number {
    let d = 0;
    const ns = NEIGHBORS[i];
    for (let k = 0; k < ns.length; k++) if (this.owner[ns[k]] === FREE && this.open(i, k)) d++;
    return d;
  }

  /** Sizes of the regions of free cells (connected through steps that cross nothing). */
  regions(): number[] {
    const seen = new Uint8Array(CELLS);
    const sizes: number[] = [];
    const stack: number[] = [];
    for (let s = 0; s < CELLS; s++) {
      if (seen[s] || this.owner[s] !== FREE) continue;
      let size = 0;
      seen[s] = 1;
      stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        size++;
        const ns = NEIGHBORS[i];
        for (let k = 0; k < ns.length; k++) {
          const n = ns[k];
          if (!seen[n] && this.owner[n] === FREE && this.open(i, k)) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
      sizes.push(size);
    }
    return sizes;
  }

  tick(): void {
    if (++this.nodes > this.budget) throw BUDGET;
  }
}

const BUDGET = new Error("budget");

/** Can words of these lengths be shared out among regions of these sizes, exactly? */
export function partitionable(sizes: number[], lengths: number[]): boolean {
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total !== lengths.reduce((a, b) => a + b, 0)) return false;
  const min = Math.min(...lengths);
  if (sizes.some((s) => s < min)) return false;
  const lens = [...lengths].sort((a, b) => b - a);
  const rem = [...sizes].sort((a, b) => b - a);
  const go = (k: number): boolean => {
    if (k === lens.length) return rem.every((r) => r === 0);
    const tried = new Set<number>();
    for (let j = 0; j < rem.length; j++) {
      const r = rem[j];
      if (r < lens[k] || tried.has(r)) continue;
      tried.add(r);
      rem[j] -= lens[k];
      if (go(k + 1)) return true;
      rem[j] += lens[k];
    }
    return false;
  };
  return go(0);
}

/**
 * Walk `len` cells from `start` through free cells (start included), calling
 * `onWalk` for each complete walk until it returns true (success: the walk
 * stays on the board) or `maxWalks` walks were offered (the board is left as
 * it was). Cells are marked with `owner` while the walk is live, so `onWalk`
 * sees the board with the walk in place, and must leave it that way when it
 * returns false.
 */
function walk(
  board: Board,
  start: number,
  len: number,
  owner: number,
  rng: Rng,
  maxWalks: number,
  onWalk: (path: number[]) => boolean,
  allow?: (cell: number, path: number[]) => boolean
): boolean {
  const path = [start];
  let offered = 0;
  let success = false;
  let stop = false;

  /**
   * Did the walk strand a free cell next to `i`? A free cell with no free
   * neighbor can never be covered, unless the walk can still step onto it
   * from its head.
   */
  const isolates = (i: number): boolean => {
    const head = path[path.length - 1];
    const more = path.length < len;
    const ns = NEIGHBORS[i];
    for (let k = 0; k < ns.length; k++) {
      const n = ns[k];
      if (board.owner[n] !== FREE || board.freeDegree(n) > 0) continue;
      if (more && reachable(head, n)) continue;
      return true;
    }
    return false;
  };
  const reachable = (a: number, b: number): boolean => {
    const k = NEIGHBORS[a].indexOf(b);
    return k >= 0 && board.open(a, k);
  };

  const step = (): void => {
    board.tick();
    if (path.length === len) {
      offered++;
      if (onWalk(path)) success = true;
      else if (offered >= maxWalks) stop = true;
      return;
    }
    const last = path[path.length - 1];
    const ns = NEIGHBORS[last];
    const order = rng.shuffle(ns.map((_, k) => k));
    for (const k of order) {
      const n = ns[k];
      if (board.owner[n] !== FREE || !board.open(last, k)) continue;
      if (allow && !allow(n, path)) continue;
      const block = STEP_BLOCK[last][k];
      if (block >= 0) board.diag[block] = STEP_KIND[last][k];
      board.owner[n] = owner;
      path.push(n);
      if (!isolates(n) && !isolates(last)) step();
      if (success) return;
      path.pop();
      board.owner[n] = FREE;
      if (block >= 0) board.diag[block] = 0;
      if (stop) return;
    }
  };

  board.owner[start] = owner;
  if (!isolates(start)) step();
  if (!success) board.owner[start] = FREE;
  return success;
}

/** One tiling: a path per word index (geometry only; reading direction is chosen later). */
function tile(lengths: number[], rng: Rng, budget: number): number[][] | null {
  const board = new Board(budget);
  const paths: number[][] = new Array(lengths.length);
  const spanLen = lengths[0];
  const others = lengths.map((_, i) => i).slice(1);

  const fill = (remaining: number[]): boolean => {
    board.tick();
    if (!remaining.length) return true;
    // The most cornered free cell; ties broken by a random scan start.
    let target = -1;
    let best = 99;
    const start = rng.int(CELLS);
    for (let o = 0; o < CELLS; o++) {
      const i = (start + o) % CELLS;
      if (board.owner[i] !== FREE) continue;
      const d = board.freeDegree(i);
      if (d < best) {
        best = d;
        target = i;
      }
    }
    if (target < 0) return false;
    // Words of the same length are interchangeable here: try each length once.
    const byLength = new Map<number, number>();
    for (const w of rng.shuffle([...remaining])) if (!byLength.has(lengths[w])) byLength.set(lengths[w], w);
    for (const w of byLength.values()) {
      const rest = remaining.filter((x) => x !== w);
      const restLengths = rest.map((x) => lengths[x]);
      const ok = walk(board, target, lengths[w], w, rng, 6, (path) => {
        if (rest.length && !partitionable(board.regions(), restLengths)) return false;
        paths[w] = [...path];
        return fill(rest);
      });
      if (ok) return true;
    }
    return false;
  };

  // 1. The span word, from one side to the opposite one.
  const axes: ("lr" | "tb")[] = spanLen >= ROWS ? ["lr", "tb"] : ["lr"];
  const axis = axes[rng.int(axes.length)];
  const far = rng.int(2) === 0;
  const startCells: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    if (axis === "lr" ? colOf(i) === (far ? COLS - 1 : 0) : rowOf(i) === (far ? ROWS - 1 : 0)) startCells.push(i);
  }
  // Steps from a cell to the side the span word still has to reach.
  const distance = (i: number) => (axis === "lr" ? (far ? colOf(i) : COLS - 1 - colOf(i)) : far ? rowOf(i) : ROWS - 1 - rowOf(i));
  const restLengths = others.map((x) => lengths[x]);
  try {
    for (const s of rng.shuffle(startCells)) {
      const ok = walk(
        board,
        s,
        spanLen,
        0,
        rng,
        8,
        (path) => {
          if (!touchesOppositeSides(path)) return false;
          if (!partitionable(board.regions(), restLengths)) return false;
          paths[0] = [...path];
          return fill(others);
        },
        // Stay within reach of the far side until the walk has touched it.
        (cell, path) => path.some((c) => distance(c) === 0) || distance(cell) <= spanLen - path.length - 1
      );
      if (ok) return paths;
    }
  } catch (err) {
    if (err !== BUDGET) throw err;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Letters and scoring
// ---------------------------------------------------------------------------

export interface GeneratedGrid {
  grid: string;
  /** Span word first, then the theme words in the theme's order. */
  words: PlacedWord[];
  /** Lower is better (see `score`). */
  score: number;
  /** Tilings built while choosing (for timing reports). */
  attempts: number;
}

function turns(path: number[]): number {
  let t = 0;
  for (let k = 2; k < path.length; k++) {
    const d1 = [rowOf(path[k - 1]) - rowOf(path[k - 2]), colOf(path[k - 1]) - colOf(path[k - 2])];
    const d2 = [rowOf(path[k]) - rowOf(path[k - 1]), colOf(path[k]) - colOf(path[k - 1])];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) t++;
  }
  return t;
}

/** Penalties: straight-line words are too easy; a theme word readable elsewhere misleads. */
function score(grid: string, words: PlacedWord[]): number {
  let s = 0;
  for (const w of words) {
    const t = turns(w.path);
    if (t === 0) s += 4;
    else if (t === 1 && w.path.length >= 6) s += 1;
    s += 8 * (tracePaths(grid, w.word, 6).length - 1);
  }
  return s;
}

export interface GenerateOptions {
  /** Good tilings to compare before picking (default 30). */
  candidates?: number;
  /** Tiling attempts before giving up (default 120). */
  maxAttempts?: number;
  /** Backtracking nodes per attempt (default 40 000). */
  budget?: number;
}

/**
 * Lay out a theme. Throws TilingError when the theme's shape is invalid or no
 * tiling was found within the attempt budget.
 */
export function generateWordHunt(theme: Pick<WordHuntTheme, "span" | "words">, seed: string, opts: GenerateOptions = {}): GeneratedGrid {
  const problems = shapeProblems(theme);
  if (problems.length) throw new TilingError(problems.join("; "));
  const { candidates = 30, maxAttempts = 120, budget = 40_000 } = opts;
  const words = [theme.span, ...theme.words].map((w) => w.toUpperCase());
  const lengths = words.map((w) => w.length);
  const rng = createRng(seed);

  let best: GeneratedGrid | null = null;
  let good = 0;
  let attempts = 0;
  while (good < candidates && attempts < maxAttempts) {
    attempts++;
    const paths = tile(lengths, rng, budget);
    if (!paths) continue;
    const cells = new Array<string>(CELLS).fill("");
    const placed: PlacedWord[] = words.map((word, i) => {
      const path = rng.int(2) ? paths[i] : [...paths[i]].reverse();
      path.forEach((c, k) => (cells[c] = word[k]));
      return { word, path, span: i === 0 };
    });
    const grid = cells.join("");
    if (grid.length !== CELLS || gridLines(grid).some(containsBlockedSubstring)) continue;
    const s = score(grid, placed);
    good++;
    if (!best || s < best.score) best = { grid, words: placed, score: s, attempts };
    if (s === 0) break;
  }
  if (!best) throw new TilingError(`no tiling found in ${attempts} attempts`);
  return { ...best, attempts };
}
