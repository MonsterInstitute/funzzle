/** Builders for hand-made positions in the mahjong tests. */

import { applyMatch, isWon, type Pair, type State } from "./engine";
import { getLayout, type LayoutId } from "./layouts";
import type { TileId } from "./tiles";

/** Position index of the cell at (x, y, z) in half-tile units; throws if there is none. */
export function at(layout: LayoutId, x: number, y: number, z: number): number {
  const i = getLayout(layout).cells.findIndex((c) => c.x === x && c.y === y && c.z === z);
  if (i < 0) throw new Error(`no cell ${x},${y},${z} in ${layout}`);
  return i;
}

/**
 * A position where only the listed cells hold tiles; every other position
 * counts as already removed. Keys are "x,y,z" in half-tile units.
 */
export function board(layout: LayoutId, tiles: Record<string, TileId>): State {
  const size = getLayout(layout).cells.length;
  const state: State = {
    layout,
    tiles: new Array(size).fill("1d"),
    removed: new Array(size).fill(true),
    history: [],
  };
  for (const [xyz, tile] of Object.entries(tiles)) {
    const [x, y, z] = xyz.split(",").map(Number);
    const p = at(layout, x, y, z);
    state.tiles[p] = tile;
    state.removed[p] = false;
  }
  return state;
}

export function replay(state: State, moves: Pair[]): State {
  return moves.reduce(applyMatch, state);
}

export function clears(state: State, moves: Pair[]): boolean {
  return isWon(replay(state, moves));
}
