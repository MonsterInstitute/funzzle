/**
 * 2048 engine: a 4×4 board of tiles that slide and merge.
 *
 * Tiles are stored as exponents (1 = 2, 2 = 4, … 11 = 2048) with stable ids,
 * so the screen can animate a tile sliding from one cell to the next.
 *
 * Seeded spawns. The tile that appears after move n is a pure function of the
 * game seed and n: `createRng(`${seed}:${n}`)` picks the empty cell (an index
 * into the empty cells in reading order) and then the value (a 2 with
 * probability 0.9, else a 4). The two starting tiles come from
 * `createRng(`${seed}:start`)`. So on the daily (seed "2048:<date>") two
 * players who make the same moves see exactly the same tiles, and an undo
 * followed by the same move brings back the same tile: undo can't be used
 * to fish for a better spawn.
 */
import { createRng } from "@/lib/games/kit/rng";

export type Dir = "up" | "down" | "left" | "right";
export const DIRS: Dir[] = ["up", "right", "down", "left"];

export interface Tile {
  id: number;
  /** Exponent: the tile shows 2 ** v. */
  v: number;
  /** Cell 0–15, reading order. */
  cell: number;
  /** Move number when this tile appeared (spawned or merged), for the pop animation. */
  born: number;
  /** "spawn" for new tiles, "merge" for tiles made by a merge on move `born`. */
  kind?: "spawn" | "merge";
}

export interface State {
  seed: string;
  tiles: Tile[];
  nextId: number;
  score: number;
  moves: number;
}

export const SIZE = 4;
export const CELLS = 16;

/** Exponents by cell (0 = empty). */
export function boardOf(state: State): number[] {
  const b = new Array<number>(CELLS).fill(0);
  for (const t of state.tiles) b[t.cell] = t.v;
  return b;
}

export function maxTile(state: State): number {
  return state.tiles.reduce((m, t) => Math.max(m, t.v), 0);
}

/** Tile value shown on screen, e.g. 2048. */
export const valueOf = (v: number) => 2 ** v;

function spawnInto(tiles: Tile[], rngSeed: string, nextId: number, born: number): { tiles: Tile[]; nextId: number } {
  const used = new Set(tiles.map((t) => t.cell));
  const empty: number[] = [];
  for (let c = 0; c < CELLS; c++) if (!used.has(c)) empty.push(c);
  if (!empty.length) return { tiles, nextId };
  const rng = createRng(rngSeed);
  const cell = empty[rng.int(empty.length)];
  const v = rng.next() < 0.9 ? 1 : 2;
  return { tiles: [...tiles, { id: nextId, v, cell, born, kind: "spawn" }], nextId: nextId + 1 };
}

/** The starting position for a seed: two tiles. */
export function newGame(seed: string): State {
  const rng = createRng(`${seed}:start`);
  const a = rng.int(CELLS);
  let b = rng.int(CELLS - 1);
  if (b >= a) b++;
  const tiles: Tile[] = [
    { id: 1, v: rng.next() < 0.9 ? 1 : 2, cell: a, born: 0, kind: "spawn" },
    { id: 2, v: rng.next() < 0.9 ? 1 : 2, cell: b, born: 0, kind: "spawn" },
  ];
  return { seed, tiles, nextId: 3, score: 0, moves: 0 };
}

/** Cells of each line, ordered from the side the tiles slide toward. */
function lines(dir: Dir): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === "left") line.push(i * SIZE + j);
      else if (dir === "right") line.push(i * SIZE + (SIZE - 1 - j));
      else if (dir === "up") line.push(j * SIZE + i);
      else line.push((SIZE - 1 - j) * SIZE + i);
    }
    out.push(line);
  }
  return out;
}
const LINES: Record<Dir, number[][]> = { up: lines("up"), down: lines("down"), left: lines("left"), right: lines("right") };

export interface SlideResult {
  tiles: Tile[];
  nextId: number;
  moved: boolean;
  gained: number;
  /** Exponents of the tiles created by merges this move. */
  merged: number[];
}

/**
 * Slide every tile toward `dir`: tiles compact, and two equal neighbours merge
 * once (the tile nearer the wall keeps its id). No spawn here.
 */
export function slide(state: State, dir: Dir): SlideResult {
  const at = new Map<number, Tile>();
  for (const t of state.tiles) at.set(t.cell, t);
  const out: Tile[] = [];
  let moved = false;
  let gained = 0;
  const merged: number[] = [];
  const born = state.moves + 1;
  for (const line of LINES[dir]) {
    const row = line.map((c) => at.get(c)).filter((t): t is Tile => !!t);
    let k = 0;
    for (let i = 0; i < row.length; i++) {
      const t = row[i];
      const next = row[i + 1];
      const cell = line[k];
      if (next && next.v === t.v) {
        const v = t.v + 1;
        out.push({ id: t.id, v, cell, born, kind: "merge" });
        gained += 2 ** v;
        merged.push(v);
        moved = true;
        i++;
      } else {
        if (cell !== t.cell) moved = true;
        out.push({ ...t, cell });
      }
      k++;
    }
  }
  return { tiles: out, nextId: state.nextId, moved, gained, merged };
}

/** Apply a move: slide, score, then the seeded spawn. Returns null when nothing moves. */
export function move(state: State, dir: Dir): State | null {
  const r = slide(state, dir);
  if (!r.moved) return null;
  const moves = state.moves + 1;
  const spawned = spawnInto(r.tiles, `${state.seed}:${moves}`, r.nextId, moves);
  return { seed: state.seed, tiles: spawned.tiles, nextId: spawned.nextId, score: state.score + r.gained, moves };
}

export function canMove(state: State, dir: Dir): boolean {
  return slide(state, dir).moved;
}

export function legalMoves(state: State): Dir[] {
  return DIRS.filter((d) => canMove(state, d));
}

export function isOver(state: State): boolean {
  if (state.tiles.length < CELLS) return false;
  return legalMoves(state).length === 0;
}

/** True when the biggest tile sits in a corner cell. */
export function maxInCorner(board: number[]): boolean {
  const max = Math.max(...board);
  return max > 0 && [0, 3, 12, 15].some((c) => board[c] === max);
}
