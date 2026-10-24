/**
 * The cut: a grid of classic jigsaw pieces with seeded tab/blank edges.
 *
 * Every interior edge belongs to two pieces. It is drawn once, in a canonical
 * direction (left→right for horizontal edges, top→bottom for vertical ones),
 * with a knob that bulges to one side (`dir`) and a little seeded jitter; each
 * piece traces it forward or backward, so neighbours always fit exactly: one
 * gets the tab, the other the matching blank. Border edges are straight.
 *
 * Coordinates are picture units (PIC_W × PIC_H). Pieces never rotate.
 */
import { createRng } from "@/lib/games/kit/rng";

export const PIC_W = 600;
export const PIC_H = 400;

export const SIZES = {
  12: { cols: 4, rows: 3 },
  24: { cols: 6, rows: 4 },
  48: { cols: 8, rows: 6 },
  96: { cols: 12, rows: 8 },
} as const;

export type PieceCount = keyof typeof SIZES;
export const PIECE_COUNTS = [12, 24, 48, 96] as const satisfies readonly PieceCount[];

export function isPieceCount(n: unknown): n is PieceCount {
  return typeof n === "number" && (PIECE_COUNTS as readonly number[]).includes(n);
}

/** One interior edge: which way the tab points and its jitter. */
export interface Edge {
  /** +1: the tab bulges down (horizontal edge) or right (vertical edge); -1 the other way. */
  dir: 1 | -1;
  /** Jitter, each in about ±0.04 of the knob size. */
  b: number;
  c: number;
  d: number;
  e: number;
  a: number;
}

/** +1 tab (sticks out), -1 blank (cut in), 0 flat border. */
export type Side = -1 | 0 | 1;

export interface Piece {
  /** row * cols + col */
  id: number;
  row: number;
  col: number;
  /** Top-left corner of the piece's cell in the picture. */
  x: number;
  y: number;
  /** Closed outline (absolute picture coordinates). */
  path: string;
  sides: { top: Side; right: Side; bottom: Side; left: Side };
  border: boolean;
  corner: boolean;
}

export interface Cut {
  seed: string;
  count: PieceCount;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Knob scale: the smaller cell side. A knob reaches 0.3 × knob past its edge. */
  knob: number;
  /** Margin around a cell that contains its tabs. */
  pad: number;
  /** horizontal[r][c]: edge below row r at column c (r < rows-1). */
  horizontal: Edge[][];
  /** vertical[r][c]: edge right of column c in row r (c < cols-1). */
  vertical: Edge[][];
  pieces: Piece[];
}

type Pt = [number, number];

const r2 = (n: number) => Math.round(n * 100) / 100;

function edgeAt(rng: { next(): number }): Edge {
  const j = () => (rng.next() - 0.5) * 0.08;
  return { dir: rng.next() < 0.5 ? 1 : -1, b: j(), c: j(), d: j(), e: j(), a: j() };
}

/**
 * The ten points (three cubic segments) of a knobbed edge from `from` to `to`
 * in the canonical direction. `normal` is the unit vector the tab bulges
 * towards when dir = +1.
 */
function knobPoints(from: Pt, to: Pt, normal: Pt, edge: Edge, knob: number): Pt[] {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ux = (to[0] - from[0]) / len;
  const uy = (to[1] - from[1]) / len;
  const t = 0.1;
  const { b, c, d, e, a } = edge;
  const f = edge.dir;
  // (along, across): `along` in edge-length fractions for the shoulders,
  // knob-size units around the middle so a knob stays round on any cell shape.
  const pt = (along: number, across: number, mid = true): Pt => {
    const s = mid ? len / 2 + (along - 0.5) * knob : along * len;
    const w = across * knob * f;
    return [r2(from[0] + ux * s + normal[0] * w), r2(from[1] + uy * s + normal[1] * w)];
  };
  return [
    from,
    pt(0.2, a, false),
    pt(0.5 + b + d, -t + c),
    pt(0.5 - t + b, t + c),
    pt(0.5 - 2 * t + b - d, 3 * t + c),
    pt(0.5 + 2 * t + b - d, 3 * t + c),
    pt(0.5 + t + b, t + c),
    pt(0.5 + b + d, -t + c),
    pt(0.8, e, false),
    to,
  ];
}

const cubics = (pts: Pt[]) =>
  [1, 4, 7].map((i) => `C${pts[i][0]} ${pts[i][1]} ${pts[i + 1][0]} ${pts[i + 1][1]} ${pts[i + 2][0]} ${pts[i + 2][1]}`).join("");

/** Cut a `count`-piece puzzle from `seed`: same seed, same cut. */
export function makeCut(seed: string, count: PieceCount): Cut {
  const { cols, rows } = SIZES[count];
  const rng = createRng(`${seed}:cut:${count}`);
  const cellW = PIC_W / cols;
  const cellH = PIC_H / rows;
  const knob = Math.min(cellW, cellH);
  const pad = Math.ceil(knob * 0.34);
  const horizontal = Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => edgeAt(rng)));
  const vertical = Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => edgeAt(rng)));

  const pieces: Piece[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = r2(col * cellW);
      const y0 = r2(row * cellH);
      const x1 = r2((col + 1) * cellW);
      const y1 = r2((row + 1) * cellH);
      let path = `M${x0} ${y0}`;
      // Top: canonical left→right; traced forward. A tab from above (dir +1) is our blank.
      if (row === 0) path += `L${x1} ${y0}`;
      else path += cubics(knobPoints([x0, y0], [x1, y0], [0, 1], horizontal[row - 1][col], knob));
      // Right: canonical top→bottom; traced forward.
      if (col === cols - 1) path += `L${x1} ${y1}`;
      else path += cubics(knobPoints([x1, y0], [x1, y1], [1, 0], vertical[row][col], knob));
      // Bottom: canonical left→right; traced backward.
      if (row === rows - 1) path += `L${x0} ${y1}`;
      else path += cubics(knobPoints([x0, y1], [x1, y1], [0, 1], horizontal[row][col], knob).reverse());
      // Left: canonical top→bottom; traced backward.
      if (col === 0) path += `L${x0} ${y0}`;
      else path += cubics(knobPoints([x0, y0], [x0, y1], [1, 0], vertical[row][col - 1], knob).reverse());
      path += "Z";
      const sides = {
        top: (row === 0 ? 0 : -horizontal[row - 1][col].dir) as Side,
        right: (col === cols - 1 ? 0 : vertical[row][col].dir) as Side,
        bottom: (row === rows - 1 ? 0 : horizontal[row][col].dir) as Side,
        left: (col === 0 ? 0 : -vertical[row][col - 1].dir) as Side,
      };
      const flat = [sides.top, sides.right, sides.bottom, sides.left].filter((s) => s === 0).length;
      pieces.push({ id: row * cols + col, row, col, x: x0, y: y0, path, sides, border: flat > 0, corner: flat >= 2 });
    }
  }
  return { seed, count, cols, rows, cellW, cellH, knob, pad, horizontal, vertical, pieces };
}

/** The bounding box of a piece including its tabs (picture units). */
export function pieceBox(cut: Cut, p: Piece): { x: number; y: number; w: number; h: number } {
  return { x: p.x - cut.pad, y: p.y - cut.pad, w: cut.cellW + 2 * cut.pad, h: cut.cellH + 2 * cut.pad };
}

/** Snap distance: how close (picture units) a dropped piece's center must be to its home. */
export function snapRadius(cut: Cut): number {
  return Math.min(cut.cellW, cut.cellH) * 0.42;
}

/** Does a piece dropped with its cell center at (cx, cy) snap into its spot? */
export function snaps(cut: Cut, p: Piece, cx: number, cy: number): boolean {
  return Math.hypot(cx - (p.x + cut.cellW / 2), cy - (p.y + cut.cellH / 2)) <= snapRadius(cut);
}

/** Seeded order of the pieces in the tray. */
export function trayOrder(seed: string, count: PieceCount): number[] {
  return createRng(`${seed}:tray:${count}`).shuffle(Array.from({ length: count }, (_, i) => i));
}
