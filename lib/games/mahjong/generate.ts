/**
 * Solvable deals by construction. The board is filled in reverse play order:
 * starting from an empty table, each step places two tiles of a matching
 * pair on positions that would both be free if they were the last tiles
 * added. Replaying the steps backwards is then a winning line, so every deal
 * comes with a solution and needs no search to prove it winnable.
 *
 * Two rules keep the fill from painting itself into a corner:
 * - a tile is only placed once everything under it is placed (otherwise the
 *   tile under it could never be free when its turn came);
 * - a placement may not leave an empty position with placed tiles somewhere
 *   along its row on both sides, because that gap could never be freed.
 * What can still go wrong (e.g. the last two positions stacked on each other)
 * is caught at the end and retried with the same random stream, so a seed
 * always gives the same deal.
 */

import { createRng, type Rng } from "@/lib/games/kit/rng";
import { geometry, getLayout, type Geometry, type LayoutId } from "./layouts";
import { TILE_SET, matchKey, type TileId } from "./tiles";
import type { Pair, State } from "./engine";

const MAX_ATTEMPTS = 400;

/** Groups tiles into matching pairs (each match key must come an even number of times). */
export function pairUp(tiles: readonly TileId[], rng: Rng): [TileId, TileId][] {
  const groups = new Map<string, TileId[]>();
  for (const t of tiles) {
    const key = matchKey(t);
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  const pairs: [TileId, TileId][] = [];
  for (const [key, list] of groups) {
    if (list.length % 2) throw new Error(`pairUp: odd number of ${key} tiles`);
    rng.shuffle(list);
    for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  }
  return pairs;
}

/**
 * One fill attempt over `positions` (all others count as already gone).
 * Returns the placement order, last-removed pair first, or null on a dead end.
 */
function fillOnce(g: Geometry, positions: readonly number[], rng: Rng): Pair[] | null {
  const target = new Uint8Array(g.size);
  for (const p of positions) target[p] = 1;
  const placed = new Uint8Array(g.size);
  const order: Pair[] = [];
  let left = positions.length;

  const supported = (p: number, except = -1) => g.below[p].every((q) => !target[q] || (placed[q] && q !== except));
  const sideOpen = (p: number) => g.left[p].every((q) => !placed[q]) || g.right[p].every((q) => !placed[q]);
  const candidates = () => positions.filter((p) => !placed[p] && supported(p) && sideOpen(p));

  /** No unplaced position may have placed tiles along its row on both sides. */
  const rowsOk = (layers: Set<number>) => {
    const reach = (p: number, side: number[][], memo: Int8Array): boolean => {
      if (memo[p] >= 0) return memo[p] === 1;
      let hit = false;
      for (const q of side[p]) {
        if (!target[q]) continue;
        if (placed[q] || reach(q, side, memo)) {
          hit = true;
          break;
        }
      }
      memo[p] = hit ? 1 : 0;
      return hit;
    };
    const memoL = new Int8Array(g.size).fill(-1);
    const memoR = new Int8Array(g.size).fill(-1);
    for (const p of positions) {
      if (placed[p] || !layers.has(g.layout.cells[p].z)) continue;
      if (reach(p, g.left, memoL) && reach(p, g.right, memoR)) return false;
    }
    return true;
  };

  while (left > 0) {
    const first = rng.shuffle(candidates());
    let done = false;
    for (const a of first) {
      placed[a] = 1;
      const second = rng.shuffle(candidates().filter((b) => supported(b, a)));
      for (const b of second) {
        placed[b] = 1;
        if (sideOpen(a) && rowsOk(new Set([g.layout.cells[a].z, g.layout.cells[b].z]))) {
          order.push([a, b]);
          left -= 2;
          done = true;
          break;
        }
        placed[b] = 0;
      }
      if (done) break;
      placed[a] = 0;
    }
    if (!done) return null;
  }
  return order;
}

/**
 * Deals `tiles` onto `positions` of a layout so the result is solvable.
 * Returns the tile per position (only `positions` are set) and the winning
 * line in play order, or null if no fill was found.
 */
export function fill(
  layout: LayoutId,
  positions: readonly number[],
  tiles: readonly TileId[],
  rng: Rng,
): { tiles: (TileId | null)[]; solution: Pair[] } | null {
  if (positions.length !== tiles.length) throw new Error("fill: positions and tiles differ in count");
  const g = geometry(layout);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const order = fillOnce(g, positions, rng);
    if (!order) continue;
    const pairs = rng.shuffle(pairUp(tiles, rng));
    const out: (TileId | null)[] = new Array(g.size).fill(null);
    order.forEach(([a, b], i) => {
      out[a] = pairs[i][0];
      out[b] = pairs[i][1];
    });
    return { tiles: out, solution: order.slice().reverse() };
  }
  return null;
}

/**
 * The tiles for a layout: the whole set for 144 positions, otherwise a random
 * selection of matching pairs (two of the four of each kind travel together).
 */
function tilesFor(count: number, rng: Rng): TileId[] {
  if (count > TILE_SET.length || count % 2) throw new Error(`tilesFor: bad tile count ${count}`);
  const pairs = rng.shuffle(pairUp(TILE_SET, rng)).slice(0, count / 2);
  return pairs.flat();
}

/** A new, solvable deal for a layout from a seed, with its winning line. */
export function generateDeal(layout: LayoutId, seed: string): { state: State; solution: Pair[] } {
  const cells = getLayout(layout).cells;
  const rng = createRng(seed);
  const tiles = tilesFor(cells.length, rng);
  const res = fill(layout, cells.map((_, i) => i), tiles, rng);
  if (!res) throw new Error(`generateDeal: no fill for ${layout} with seed ${seed}`);
  return {
    state: {
      layout,
      tiles: res.tiles as TileId[],
      removed: cells.map(() => false),
      history: [],
    },
    solution: res.solution,
  };
}
