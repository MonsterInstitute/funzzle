/**
 * Board layouts as plain data, plus the derived geometry the engine needs.
 *
 * Positions use a half-tile grid: a tile at (x, y) covers the cells
 * x..x+1 and y..y+1, so a tile is 2 units wide and 2 tall, and a tile at
 * x + 1 sits half a tile over. Two tiles on one layer overlap when both
 * |dx| < 2 and |dy| < 2; a tile is the left neighbour of another on its
 * layer when it is exactly 2 units to the left and they share a row
 * (|dy| < 2).
 */

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export type LayoutId = "turtle" | "pyramid" | "fortress" | "bridge" | "quick";

export interface Layout {
  id: LayoutId;
  name: string;
  /** Sorted by z, then y, then x, so a renderer can draw them in order. */
  cells: readonly Cell[];
  /** Board size in half-tile units. */
  width: number;
  height: number;
  depth: number;
}

/**
 * A block of tiles in tile units (half steps allowed): columns x0..x1 and
 * rows y0..y1, both inclusive, on layer z.
 */
function block(x0: number, x1: number, y0: number, y1: number, z: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) cells.push({ x: x * 2, y: y * 2, z });
  }
  return cells;
}

/** One tile, in tile units. */
const one = (x: number, y: number, z: number): Cell[] => [{ x: x * 2, y: y * 2, z }];

function define(id: LayoutId, name: string, parts: Cell[][]): Layout {
  const raw = parts.flat();
  const minX = Math.min(...raw.map((c) => c.x));
  const minY = Math.min(...raw.map((c) => c.y));
  const cells = raw
    .map((c) => Object.freeze({ x: c.x - minX, y: c.y - minY, z: c.z }))
    .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  return Object.freeze({
    id,
    name,
    cells: Object.freeze(cells),
    width: Math.max(...cells.map((c) => c.x)) + 2,
    height: Math.max(...cells.map((c) => c.y)) + 2,
    depth: Math.max(...cells.map((c) => c.z)) + 1,
  });
}

/** The classic 144-tile "turtle": 87 + 36 + 16 + 4 + 1. */
const turtle = define("turtle", "Turtle", [
  block(1, 12, 0, 0, 0),
  block(3, 10, 1, 1, 0),
  block(2, 11, 2, 2, 0),
  block(1, 12, 3, 4, 0),
  block(2, 11, 5, 5, 0),
  block(3, 10, 6, 6, 0),
  block(1, 12, 7, 7, 0),
  one(0, 3.5, 0),
  one(13, 3.5, 0),
  one(14, 3.5, 0),
  block(4, 9, 1, 6, 1),
  block(5, 8, 2, 5, 2),
  block(6, 7, 3, 4, 3),
  one(6.5, 3.5, 4),
]);

/** A stepped pyramid, 134 tiles: 70 + 40 + 18 + 4 + 2. */
const pyramid = define("pyramid", "Pyramid", [
  block(0, 9, 0, 6, 0),
  block(1, 8, 1, 5, 1),
  block(2, 7, 2, 4, 2),
  block(3, 6, 3, 3, 3),
  block(4, 5, 3, 3, 4),
]);

/** Walls around a keep with corner towers, 110 tiles. */
function ring(x0: number, x1: number, y0: number, y1: number, z: number): Cell[] {
  return [
    ...block(x0, x1, y0, y0, z),
    ...block(x0, x1, y1, y1, z),
    ...block(x0, x0, y0 + 1, y1 - 1, z),
    ...block(x1, x1, y0 + 1, y1 - 1, z),
  ];
}
const fortress = define("fortress", "Fortress", [
  ring(0, 11, 0, 7, 0), // 36
  block(3, 8, 2, 5, 0), // 24
  ring(0, 11, 0, 7, 1), // 36
  block(4, 7, 3, 4, 1), // 8
  one(0, 0, 2),
  one(11, 0, 2),
  one(0, 7, 2),
  one(11, 7, 2),
  block(5, 6, 3.5, 3.5, 2), // 2
]);

/** Two piers joined by a road deck, 118 tiles: 60 + 44 + 12 + 2. */
const bridge = define("bridge", "Bridge", [
  block(0, 3, 0, 5, 0),
  block(10, 13, 0, 5, 0),
  block(4, 9, 2, 3, 0),
  block(0, 3, 1, 4, 1),
  block(10, 13, 1, 4, 1),
  block(4, 9, 2, 3, 1),
  block(1, 2, 2, 3, 2),
  block(11, 12, 2, 3, 2),
  block(5, 8, 2.5, 2.5, 2),
  block(6, 7, 2.5, 2.5, 3),
]);

/** A small 72-tile board for phones: 40 + 4 wings + 18 + 8 + 2. */
const quick = define("quick", "Quick", [
  block(0, 7, 0, 4, 0),
  one(-1, 1.5, 0),
  one(-1, 2.5, 0),
  one(8, 1.5, 0),
  one(8, 2.5, 0),
  block(1, 6, 1, 3, 1),
  block(2, 5, 1.5, 2.5, 2),
  block(3, 4, 2, 2, 3),
]);

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = Object.freeze({ turtle, pyramid, fortress, bridge, quick });

export const LAYOUT_IDS: readonly LayoutId[] = Object.freeze(Object.keys(LAYOUTS) as LayoutId[]);

export function isLayoutId(id: string): id is LayoutId {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, id);
}

export function getLayout(id: LayoutId): Layout {
  if (!isLayoutId(id)) throw new Error(`Unknown mahjong layout ${id}`);
  return LAYOUTS[id];
}

/** Neighbour lists by position index, derived once per layout. */
export interface Geometry {
  layout: Layout;
  size: number;
  /** Tiles on any higher layer overlapping this one: all must be gone before it is free. */
  above: number[][];
  /** Tiles on any lower layer this one rests on (directly or not). */
  below: number[][];
  /** Same-layer neighbours touching the left / right side. */
  left: number[][];
  right: number[][];
}

const overlaps = (a: Cell, b: Cell) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

const geometries = new Map<LayoutId, Geometry>();

export function geometry(id: LayoutId): Geometry {
  const cached = geometries.get(id);
  if (cached) return cached;
  const layout = getLayout(id);
  const cells = layout.cells;
  const size = cells.length;
  const g: Geometry = {
    layout,
    size,
    above: cells.map(() => []),
    below: cells.map(() => []),
    left: cells.map(() => []),
    right: cells.map(() => []),
  };
  for (let p = 0; p < size; p++) {
    for (let q = 0; q < size; q++) {
      if (p === q) continue;
      const a = cells[p];
      const b = cells[q];
      if (b.z > a.z && overlaps(a, b)) g.above[p].push(q);
      if (b.z < a.z && overlaps(a, b)) g.below[p].push(q);
      if (b.z === a.z && Math.abs(a.y - b.y) < 2) {
        if (b.x === a.x - 2) g.left[p].push(q);
        if (b.x === a.x + 2) g.right[p].push(q);
      }
    }
  }
  geometries.set(id, g);
  return g;
}
