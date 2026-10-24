/**
 * Block Puzzle engine: an 8×8 board, three pieces at a time, full rows and
 * columns clear together. Pieces never rotate: each orientation is its own
 * piece in the set.
 *
 * Randomness: piece n of a game is a pure function of (seed, n) via
 * createRng(`${seed}#${n}`), so a daily sequence is the same for everyone and
 * an endless practice game never needs to store its future pieces. The daily
 * stores its finite sequence (DAILY_PIECES) anyway, so a later change to the
 * piece weights never swaps a sequence people are playing.
 *
 * Scoring (matches lib/aeo.ts): 1 point per placed square; clearing n lines
 * with one piece scores 10·n(n+1)/2 (10, 30, 60, 100 …); each consecutive
 * clearing piece adds a combo bonus of 10 per step (2nd in a row +10, 3rd +20 …).
 */
import { createRng } from "@/lib/games/kit/rng";

export const SIZE = 8;
export const CELLS = SIZE * SIZE;
/** Daily: 25 rounds of three pieces, so every player gets the same, finite game. */
export const DAILY_ROUNDS = 25;
export const DAILY_PIECES = DAILY_ROUNDS * 3;

export interface Piece {
  id: string;
  name: string;
  /** [row, col] offsets from the piece's top-left. */
  cells: [number, number][];
  w: number;
  h: number;
  /** Color index 1–6 (components/block uses the same palette). */
  color: number;
  weight: number;
}

type Def = [id: string, name: string, rows: string[], weight: number, color: number];

const DEFS: Def[] = [
  ["1", "single square", ["#"], 1.5, 5],
  ["2h", "2-bar", ["##"], 2.5, 4],
  ["2v", "2-bar", ["#", "#"], 2.5, 4],
  ["3h", "3-bar", ["###"], 2.5, 3],
  ["3v", "3-bar", ["#", "#", "#"], 2.5, 3],
  ["4h", "4-bar", ["####"], 1.6, 2],
  ["4v", "4-bar", ["#", "#", "#", "#"], 1.6, 2],
  ["5h", "5-bar", ["#####"], 1, 1],
  ["5v", "5-bar", ["#", "#", "#", "#", "#"], 1, 1],
  ["o2", "2×2 square", ["##", "##"], 3, 6],
  ["o3", "3×3 square", ["###", "###", "###"], 1.1, 1],
  ["c2a", "small corner", ["##", "#."], 1.5, 5],
  ["c2b", "small corner", ["##", ".#"], 1.5, 5],
  ["c2c", "small corner", ["#.", "##"], 1.5, 5],
  ["c2d", "small corner", [".#", "##"], 1.5, 5],
  ["c3a", "big corner", ["###", "#..", "#.."], 0.7, 2],
  ["c3b", "big corner", ["###", "..#", "..#"], 0.7, 2],
  ["c3c", "big corner", ["#..", "#..", "###"], 0.7, 2],
  ["c3d", "big corner", ["..#", "..#", "###"], 0.7, 2],
  ["la", "L piece", ["#.", "#.", "##"], 0.8, 6],
  ["lb", "L piece", [".#", ".#", "##"], 0.8, 6],
  ["lc", "L piece", ["##", "#.", "#."], 0.8, 6],
  ["ld", "L piece", ["##", ".#", ".#"], 0.8, 6],
  ["le", "L piece", ["###", "#.."], 0.8, 6],
  ["lf", "L piece", ["###", "..#"], 0.8, 6],
  ["lg", "L piece", ["#..", "###"], 0.8, 6],
  ["lh", "L piece", ["..#", "###"], 0.8, 6],
  ["ta", "T piece", ["###", ".#."], 0.9, 3],
  ["tb", "T piece", [".#.", "###"], 0.9, 3],
  ["tc", "T piece", ["#.", "##", "#."], 0.9, 3],
  ["td", "T piece", [".#", "##", ".#"], 0.9, 3],
  ["sa", "S piece", [".##", "##."], 0.7, 4],
  ["sb", "S piece", ["#.", "##", ".#"], 0.7, 4],
  ["za", "Z piece", ["##.", ".##"], 0.7, 4],
  ["zb", "Z piece", [".#", "##", "#."], 0.7, 4],
];

export const PIECES: Record<string, Piece> = Object.fromEntries(
  DEFS.map(([id, name, rows, weight, color]) => {
    const cells: [number, number][] = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch === "#" && cells.push([r, c])));
    return [id, { id, name, cells, w: Math.max(...rows.map((r) => r.length)), h: rows.length, color, weight }];
  })
);
export const PIECE_IDS = DEFS.map((d) => d[0]);
const TOTAL_WEIGHT = DEFS.reduce((n, d) => n + d[3], 0);

/** Piece `index` of the game with this seed. */
export function pieceAt(seed: string, index: number): string {
  let x = createRng(`${seed}#${index}`).next() * TOTAL_WEIGHT;
  for (const d of DEFS) {
    x -= d[3];
    if (x < 0) return d[0];
  }
  return DEFS[DEFS.length - 1][0];
}

export function sequence(seed: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => pieceAt(seed, i));
}

/** A stored daily sequence that this engine can play. */
export function validSequence(pieces: unknown): pieces is string[] {
  return Array.isArray(pieces) && pieces.length > 0 && pieces.every((id) => typeof id === "string" && id in PIECES);
}

export interface State {
  /** 64 cells, row-major: 0 empty, else the piece color 1–6. */
  board: number[];
  seed: string;
  /** The daily's finite sequence; null = endless practice from the seed. */
  seq: string[] | null;
  /** Index of the next piece to deal. */
  next: number;
  /** The three slots; null once a slot's piece is placed. */
  tray: (string | null)[];
  score: number;
  /** Consecutive clearing pieces (0 after a piece that clears nothing). */
  combo: number;
  bestCombo: number;
  lines: number;
  /** Most lines cleared by one piece. */
  maxLines: number;
  placed: number;
  /** The board was emptied by a clear at least once. */
  cleanBoard: boolean;
  secondChanceUsed: boolean;
}

function deal(s: State): State {
  const tray: (string | null)[] = [];
  let next = s.next;
  for (let i = 0; i < 3; i++) {
    if (s.seq) tray.push(next < s.seq.length ? s.seq[next++] : null);
    else tray.push(pieceAt(s.seed, next++));
  }
  return { ...s, tray, next };
}

export function newGame(seed: string, seq: string[] | null = null): State {
  return deal({
    board: new Array(CELLS).fill(0),
    seed,
    seq,
    next: 0,
    tray: [null, null, null],
    score: 0,
    combo: 0,
    bestCombo: 0,
    lines: 0,
    maxLines: 0,
    placed: 0,
    cleanBoard: false,
    secondChanceUsed: false,
  });
}

export function canPlace(board: number[], pieceId: string, row: number, col: number): boolean {
  const p = PIECES[pieceId];
  if (!p || row < 0 || col < 0 || row + p.h > SIZE || col + p.w > SIZE) return false;
  return p.cells.every(([r, c]) => board[(row + r) * SIZE + col + c] === 0);
}

/** Every top-left [row, col] where the piece fits. */
export function placements(board: number[], pieceId: string): [number, number][] {
  const p = PIECES[pieceId];
  const out: [number, number][] = [];
  for (let r = 0; r + p.h <= SIZE; r++) for (let c = 0; c + p.w <= SIZE; c++) if (canPlace(board, pieceId, r, c)) out.push([r, c]);
  return out;
}

export function fitsAnywhere(board: number[], pieceId: string): boolean {
  const p = PIECES[pieceId];
  for (let r = 0; r + p.h <= SIZE; r++) for (let c = 0; c + p.w <= SIZE; c++) if (canPlace(board, pieceId, r, c)) return true;
  return false;
}

/** Points for clearing n lines with one piece. */
export function lineScore(n: number): number {
  return (10 * n * (n + 1)) / 2;
}

/** Full rows and columns of a board. */
export function fullLines(board: number[]): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let row = true;
    let col = true;
    for (let j = 0; j < SIZE; j++) {
      if (!board[i * SIZE + j]) row = false;
      if (!board[j * SIZE + i]) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  return { rows, cols };
}

/** The board after dropping a piece (no clearing), or null if it doesn't fit. */
export function drop(board: number[], pieceId: string, row: number, col: number): number[] | null {
  if (!canPlace(board, pieceId, row, col)) return null;
  const p = PIECES[pieceId];
  const b = board.slice();
  for (const [r, c] of p.cells) b[(row + r) * SIZE + col + c] = p.color;
  return b;
}

export function clearLines(board: number[], rows: number[], cols: number[]): number[] {
  const b = board.slice();
  for (const r of rows) for (let c = 0; c < SIZE; c++) b[r * SIZE + c] = 0;
  for (const c of cols) for (let r = 0; r < SIZE; r++) b[r * SIZE + c] = 0;
  return b;
}

export interface PlaceResult {
  state: State;
  rows: number[];
  cols: number[];
  points: number;
  linePoints: number;
  comboBonus: number;
}

/** Place the piece in tray `slot` with its top-left at (row, col). Throws if illegal. */
export function place(s: State, slot: number, row: number, col: number): PlaceResult {
  const id = s.tray[slot];
  if (!id) throw new Error("empty slot");
  const dropped = drop(s.board, id, row, col);
  if (!dropped) throw new Error("piece doesn't fit there");
  const { rows, cols } = fullLines(dropped);
  const n = rows.length + cols.length;
  const board = n ? clearLines(dropped, rows, cols) : dropped;
  const combo = n ? s.combo + 1 : 0;
  const linePoints = lineScore(n);
  const comboBonus = n ? 10 * (combo - 1) : 0;
  const points = PIECES[id].cells.length + linePoints + comboBonus;
  const tray = s.tray.slice();
  tray[slot] = null;
  let next: State = {
    ...s,
    board,
    tray,
    score: s.score + points,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    lines: s.lines + n,
    maxLines: Math.max(s.maxLines, n),
    placed: s.placed + 1,
    cleanBoard: s.cleanBoard || (n > 0 && board.every((v) => !v)),
  };
  if (tray.every((t) => t === null)) next = deal(next);
  return { state: next, rows, cols, points, linePoints, comboBonus };
}

/** The daily's pieces are all placed. */
export function sequenceDone(s: State): boolean {
  return s.tray.every((t) => t === null);
}

/** Pieces in hand, none of which fits. */
export function isStuck(s: State): boolean {
  return s.tray.some((t) => t !== null) && s.tray.every((t) => t === null || !fitsAnywhere(s.board, t));
}

export function isOver(s: State): boolean {
  return sequenceDone(s) || isStuck(s);
}

/** Pieces still to place (tray + undealt) for a daily; null for endless practice. */
export function piecesLeft(s: State): number | null {
  if (!s.seq) return null;
  return s.tray.filter(Boolean).length + Math.max(0, s.seq.length - s.next);
}

/**
 * Second chance (opt-in rewarded ad, once per game): clear three of the
 * occupied rows, chosen from the seed so it can't be re-rolled.
 */
export function secondChance(s: State): State {
  if (s.secondChanceUsed) return s;
  const occupied = Array.from({ length: SIZE }, (_, r) => r).filter((r) => s.board.slice(r * SIZE, r * SIZE + SIZE).some(Boolean));
  const rows = createRng(`${s.seed}:second:${s.placed}`).shuffle(occupied).slice(0, 3);
  return { ...s, board: clearLines(s.board, rows, []), secondChanceUsed: true, combo: 0 };
}
