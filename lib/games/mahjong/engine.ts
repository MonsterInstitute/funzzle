/**
 * Mahjong Solitaire rules: which tiles are free, which pairs match, removing
 * pairs, undo and reshuffling. States are plain JSON values and are never
 * mutated, so the UI can store them and keep old ones around.
 *
 * A tile is free when no tile on a higher layer overlaps it and its left or
 * right side is open (no tile on its layer touching that side).
 */

import { createRng } from "@/lib/games/kit/rng";
import { fill } from "./generate";
import { geometry, getLayout, isLayoutId, type LayoutId } from "./layouts";
import { isTileId, tilesMatch, type TileId } from "./tiles";

/** Two position indices into the layout's cells. */
export type Pair = [number, number];

export type HistoryEntry =
  | { kind: "match"; pair: Pair }
  /** The tile per position before a reshuffle, so it can be undone. */
  | { kind: "shuffle"; before: TileId[] };

export interface State {
  layout: LayoutId;
  /** Tile per position (index into the layout's cells); removed tiles keep their id. */
  tiles: TileId[];
  /** removed[p] is true once the tile at position p has been matched. */
  removed: boolean[];
  /** Every match and shuffle so far, oldest first. */
  history: HistoryEntry[];
}

/** A state from a layout and its tiles, nothing removed yet. */
export function newGame(layout: LayoutId, tiles: TileId[]): State {
  const cells = getLayout(layout).cells;
  if (tiles.length !== cells.length) throw new Error(`newGame: ${layout} needs ${cells.length} tiles`);
  if (!tiles.every(isTileId)) throw new Error("newGame: unknown tile id");
  return { layout, tiles: tiles.slice(), removed: cells.map(() => false), history: [] };
}

/** Checks a state that came from storage or the network. */
export function isValidState(value: unknown): value is State {
  const s = value as State;
  if (!s || typeof s !== "object" || typeof s.layout !== "string" || !isLayoutId(s.layout)) return false;
  const size = getLayout(s.layout).cells.length;
  return (
    Array.isArray(s.tiles) &&
    s.tiles.length === size &&
    s.tiles.every((t) => typeof t === "string" && isTileId(t)) &&
    Array.isArray(s.removed) &&
    s.removed.length === size &&
    s.removed.every((r) => typeof r === "boolean") &&
    Array.isArray(s.history)
  );
}

export function isFree(state: State, p: number): boolean {
  if (state.removed[p] !== false) return false;
  const g = geometry(state.layout);
  const gone = (q: number) => state.removed[q];
  return g.above[p].every(gone) && (g.left[p].every(gone) || g.right[p].every(gone));
}

/** Positions of every free tile, in layout order. */
export function freeTiles(state: State): number[] {
  const out: number[] = [];
  for (let p = 0; p < state.tiles.length; p++) if (isFree(state, p)) out.push(p);
  return out;
}

/** Why a pair cannot be matched, or null when it can. */
function illegalReason(state: State, pair: Pair): string | null {
  const [a, b] = pair;
  const n = state.tiles.length;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n || b >= n) return "bad position";
  if (a === b) return "same tile";
  if (!isFree(state, a) || !isFree(state, b)) return "tile is not free";
  return tilesMatch(state.tiles[a], state.tiles[b]) ? null : "tiles do not match";
}

export function canMatch(state: State, pair: Pair): boolean {
  return illegalReason(state, pair) === null;
}

/** Every pair of free, matching tiles (a < b). */
export function matchingPairs(state: State): Pair[] {
  const free = freeTiles(state);
  const pairs: Pair[] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (tilesMatch(state.tiles[free[i]], state.tiles[free[j]])) pairs.push([free[i], free[j]]);
    }
  }
  return pairs;
}

/** Removes a matching pair and returns the new state; throws on an illegal pair. */
export function applyMatch(state: State, pair: Pair): State {
  const reason = illegalReason(state, pair);
  if (reason) throw new Error(`Illegal match ${JSON.stringify(pair)}: ${reason}`);
  const removed = state.removed.slice();
  removed[pair[0]] = true;
  removed[pair[1]] = true;
  return { ...state, removed, history: [...state.history, { kind: "match", pair: [pair[0], pair[1]] }] };
}

/** The state before the last match or shuffle, or the same state if there is none. */
export function undo(state: State): State {
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  const history = state.history.slice(0, -1);
  if (last.kind === "shuffle") return { ...state, tiles: last.before.slice(), history };
  const removed = state.removed.slice();
  removed[last.pair[0]] = false;
  removed[last.pair[1]] = false;
  return { ...state, removed, history };
}

export function remaining(state: State): number {
  return state.removed.reduce((n, r) => (r ? n : n + 1), 0);
}

export function isWon(state: State): boolean {
  return state.removed.every(Boolean);
}

/** Tiles are left but no free pair matches. */
export function isStuck(state: State): boolean {
  return !isWon(state) && matchingPairs(state).length === 0;
}

/** Matches made so far (shuffles excluded). */
export function matchCount(state: State): number {
  return state.history.reduce((n, h) => (h.kind === "match" ? n + 1 : n), 0);
}

export function shuffleCount(state: State): number {
  return state.history.length - matchCount(state);
}

/**
 * Deals the remaining tiles again onto the remaining positions so the board
 * can be cleared, using the same reverse fill as new deals. Returns the new
 * state (with the shuffle in its history, so undo restores the old tiles)
 * and the winning line, or null when no arrangement of these positions can
 * be cleared at all (for example the last two tiles stacked on each other).
 */
export function shuffleRemaining(state: State, seed: string): { state: State; solution: Pair[] } | null {
  const positions: number[] = [];
  const tiles: TileId[] = [];
  state.removed.forEach((r, p) => {
    if (!r) {
      positions.push(p);
      tiles.push(state.tiles[p]);
    }
  });
  if (positions.length === 0) return null;
  const res = fill(state.layout, positions, tiles, createRng(seed));
  if (!res) return null;
  const next = state.tiles.slice();
  for (const p of positions) next[p] = res.tiles[p]!;
  return {
    state: { ...state, tiles: next, history: [...state.history, { kind: "shuffle", before: state.tiles.slice() }] },
    solution: res.solution,
  };
}

/** Identity of a position for caching: layout, remaining tiles and where they are. */
export function positionKey(state: State): string {
  return state.layout + ":" + state.tiles.map((t, p) => (state.removed[p] ? "-" : t)).join(",");
}
