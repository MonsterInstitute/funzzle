/**
 * 2048 coach: the best next slide by expectimax search, with a plain-English
 * reason.
 *
 * The search alternates the player's move (max) with the random spawn
 * (chance: a 2 with probability 0.9, a 4 with 0.1, in any empty cell). It
 * looks two moves ahead, three when the board is crowded (≤ 4 empty cells,
 * where mistakes are fatal), and samples at most a few empty cells per chance
 * node to stay fast. Leaves are scored by the usual 2048 heuristics:
 *
 *   - empty cells (room to manoeuvre),
 *   - merges (equal neighbours ready to combine),
 *   - monotonicity (rows and columns that rise or fall steadily),
 *   - the corner (the biggest tile sitting in a corner),
 *   - minus a penalty for big tiles scattered around the board.
 *
 * Boards are 4 rows of 16 bits (one 4-bit exponent per cell, column 0 in the
 * low bits), and every row's slide and score is precomputed, so a decision
 * takes a few milliseconds.
 */
import { boardOf, legalMoves, maxInCorner, move as applyMove, slide, type Dir, type State } from "./engine";

type Board = [number, number, number, number];

const ROWS = 1 << 16;
const leftRow = new Uint16Array(ROWS);
const rightRow = new Uint16Array(ROWS);
const rowScore = new Float64Array(ROWS);
const rowHeur = new Float64Array(ROWS);

const W = { lost: 200_000, empty: 270, merges: 700, mono: 47, monoPow: 4, sum: 11, sumPow: 3.5, corner: 400 };

function cellsOf(row: number): number[] {
  return [row & 15, (row >> 4) & 15, (row >> 8) & 15, (row >> 12) & 15];
}
function rowOf(c: number[]): number {
  return c[0] | (c[1] << 4) | (c[2] << 8) | (c[3] << 12);
}
function reverseRow(row: number): number {
  const c = cellsOf(row);
  return rowOf([c[3], c[2], c[1], c[0]]);
}

let ready = false;
/** Build the row tables on first use (not at import: the daily page imports this module). */
function init() {
  if (ready) return;
  ready = true;
  for (let r = 0; r < ROWS; r++) buildRow(r);
  for (let r = 0; r < ROWS; r++) rightRow[r] = reverseRow(leftRow[reverseRow(r)]);
}

function buildRow(r: number) {
  const c = cellsOf(r);
  // Slide left: compact, merge once.
  const tiles = c.filter((v) => v);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1] && tiles[i] < 15) {
      out.push(tiles[i] + 1);
      gained += 2 ** (tiles[i] + 1);
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < 4) out.push(0);
  leftRow[r] = rowOf(out);
  rowScore[r] = gained;

  // Heuristic for this row.
  let sum = 0;
  let empty = 0;
  let merges = 0;
  let prev = 0;
  let counter = 0;
  for (const v of c) {
    sum += v ** W.sumPow;
    if (v === 0) empty++;
    else {
      if (prev === v) counter++;
      else if (counter > 0) {
        merges += 1 + counter;
        counter = 0;
      }
      prev = v;
    }
  }
  if (counter > 0) merges += 1 + counter;
  let monoL = 0;
  let monoR = 0;
  for (let i = 1; i < 4; i++) {
    if (c[i - 1] > c[i]) monoL += c[i - 1] ** W.monoPow - c[i] ** W.monoPow;
    else monoR += c[i] ** W.monoPow - c[i - 1] ** W.monoPow;
  }
  rowHeur[r] = W.lost + W.empty * empty + W.merges * merges - W.mono * Math.min(monoL, monoR) - W.sum * sum;
}
const rightScore = (r: number) => rowScore[reverseRow(r)];

function transpose(b: Board): Board {
  const out: Board = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c] |= ((b[r] >> (4 * c)) & 15) << (4 * r);
  return out;
}

export function toBoard(cells: number[]): Board {
  const b: Board = [0, 0, 0, 0];
  for (let i = 0; i < 16; i++) b[i >> 2] |= Math.min(15, cells[i]) << (4 * (i & 3));
  return b;
}

const same = (a: Board, b: Board) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/** Slide a packed board; returns null when nothing moves. */
function moveBoard(b: Board, dir: Dir): { board: Board; score: number } | null {
  let out: Board;
  let score = 0;
  if (dir === "left" || dir === "right") {
    out = b.map((r) => (dir === "left" ? leftRow[r] : rightRow[r])) as Board;
    for (const r of b) score += dir === "left" ? rowScore[r] : rightScore(r);
  } else {
    const t = transpose(b);
    const moved = t.map((r) => (dir === "up" ? leftRow[r] : rightRow[r])) as Board;
    for (const r of t) score += dir === "up" ? rowScore[r] : rightScore(r);
    out = transpose(moved);
  }
  return same(out, b) ? null : { board: out, score };
}

function cellAt(b: Board, i: number): number {
  return (b[i >> 2] >> (4 * (i & 3))) & 15;
}

export function heuristic(b: Board): number {
  init();
  const t = transpose(b);
  let h = 0;
  for (let i = 0; i < 4; i++) h += rowHeur[b[i]] + rowHeur[t[i]];
  let max = 0;
  for (let i = 0; i < 16; i++) max = Math.max(max, cellAt(b, i));
  if ([0, 3, 12, 15].some((c) => cellAt(b, c) === max)) h += W.corner * max;
  return h;
}

const DIRS: Dir[] = ["up", "right", "down", "left"];
/** Empty cells sampled per chance node (spread evenly over the empties). */
const SAMPLE = 6;

function maxNode(b: Board, depth: number, prob: number): number {
  let best = -Infinity;
  for (const d of DIRS) {
    const m = moveBoard(b, d);
    if (m) best = Math.max(best, chanceNode(m.board, depth, prob));
  }
  // No move: the game is lost here.
  return best === -Infinity ? 0 : best;
}

/** Branches less likely than this are scored by the heuristic instead of searched. */
const MIN_PROB = 0.0004;
/** Chance nodes already searched during one decision (board → depth and value). */
let cache = new Map<string, { depth: number; value: number }>();

function chanceNode(b: Board, depth: number, prob: number): number {
  if (depth <= 0 || prob < MIN_PROB) return heuristic(b);
  const key = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  const hit = cache.get(key);
  if (hit && hit.depth >= depth) return hit.value;
  const empties: number[] = [];
  for (let i = 0; i < 16; i++) if (!cellAt(b, i)) empties.push(i);
  if (!empties.length) return heuristic(b);
  const step = Math.max(1, empties.length / SAMPLE);
  const n = Math.ceil(empties.length / step);
  let total = 0;
  for (let k = 0; k < empties.length; k += step) {
    const i = empties[Math.floor(k)];
    const row = i >> 2;
    const shift = 4 * (i & 3);
    const two = b.slice() as Board;
    two[row] |= 1 << shift;
    total += 0.9 * maxNode(two, depth - 1, (prob * 0.9) / n);
    const four = b.slice() as Board;
    four[row] |= 2 << shift;
    total += 0.1 * maxNode(four, depth - 1, (prob * 0.1) / n);
  }
  const value = total / n;
  cache.set(key, { depth, value });
  return value;
}

export type Reason = "only" | "merge-big" | "corner" | "space" | "order" | "merge";

export interface Hint {
  dir: Dir;
  reason: Reason;
  /** "Slide left." plus the reason in one sentence. */
  text: string;
  /** Expectimax value of each legal move (for tests and the why panel). */
  values: Partial<Record<Dir, number>>;
}

const DIR_WORD: Record<Dir, string> = { up: "up", down: "down", left: "left", right: "right" };

export const WHY: Record<Reason, string> = {
  only: "It’s the only slide that changes the board, so there’s no choice to make.",
  "merge-big": "It builds your biggest tile. Big merges are where the points are, and every merge frees a square.",
  corner: "It keeps your biggest tile in its corner. The other slides would pull it out, and a big tile in the middle blocks everything around it.",
  space: "It leaves the most empty squares. Room to move is what keeps a 2048 game alive.",
  order: "It keeps your rows ordered from big to small, so the next merges line up along the edge.",
  merge: "It merges tiles now, freeing squares while keeping the board tidy.",
};

/**
 * The coach's best move for this position, or null when no move is left.
 * `depth` overrides the adaptive search depth (2, or 3 on crowded boards).
 */
export function bestMove(state: State, opts: { depth?: number } = {}): Hint | null {
  const legal = legalMoves(state);
  if (!legal.length) return null;
  init();
  const cells = boardOf(state);
  const b = toBoard(cells);
  const empty = cells.filter((v) => !v).length;
  const depth = opts.depth ?? (empty <= 4 ? 3 : 2);
  const values: Partial<Record<Dir, number>> = {};
  let best: Dir = legal[0];
  cache = new Map();
  for (const d of legal) {
    const m = moveBoard(b, d);
    if (!m) continue;
    // A small share of the board's value right after the slide breaks near
    // ties toward the move that's tidy now, not one that needs fixing later.
    values[d] = chanceNode(m.board, depth, 1) + 0.05 * heuristic(m.board);
    if (values[d]! > values[best]!) best = d;
  }
  cache = new Map();
  const reason = reasonFor(state, best, legal);
  return { dir: best, reason, text: `Slide ${DIR_WORD[best]}. ${WHY[reason]}`, values };
}

function reasonFor(state: State, dir: Dir, legal: Dir[]): Reason {
  if (legal.length === 1) return "only";
  const before = boardOf(state);
  const max = Math.max(...before);
  const r = slide(state, dir);
  const after = new Array<number>(16).fill(0);
  for (const t of r.tiles) after[t.cell] = t.v;
  if (r.merged.some((v) => v > max) || (max >= 5 && r.merged.some((v) => v === max))) return "merge-big";
  const others = legal.filter((d) => d !== dir);
  const outOfCorner = (d: Dir) => {
    const s = slide(state, d);
    const b = new Array<number>(16).fill(0);
    for (const t of s.tiles) b[t.cell] = t.v;
    return !maxInCorner(b);
  };
  if (maxInCorner(before) && maxInCorner(after) && others.some(outOfCorner)) return "corner";
  const empties = (d: Dir) => slide(state, d).tiles.length;
  // Fewer tiles after the slide = more empty squares.
  if (others.every((d) => empties(d) > r.tiles.length)) return "space";
  if (r.merged.length) return "merge";
  return "order";
}

/**
 * Self-play with the coach (tests, tuning): plays up to `maxMoves` moves and
 * returns the final state.
 */
export function coachPlay(state: State, maxMoves = 5000, depth?: number): State {
  let s = state;
  for (let i = 0; i < maxMoves; i++) {
    const h = bestMove(s, { depth });
    if (!h) break;
    s = applyMove(s, h.dir)!;
  }
  return s;
}
