import { parseISODate } from "./dates";
import { STRANDS_PUZZLES, type StrandsPuzzle } from "./content/strands";

export type { StrandsPuzzle };
export { STRANDS_PUZZLES };

export const STRANDS_ROWS = 8;
export const STRANDS_COLS = 6;

export function puzzleForDate(iso: string): StrandsPuzzle {
  const dow = parseISODate(iso).getUTCDay();
  return STRANDS_PUZZLES[dow % STRANDS_PUZZLES.length];
}

export type Cell = [number, number];

/** Cells along the straight line between two endpoints, or null if not collinear. */
export function lineCells(start: Cell, end: Cell): Cell[] | null {
  const [r1, c1] = start;
  const [r2, c2] = end;
  const dR = r2 - r1;
  const dC = c2 - c1;
  const straight = r1 === r2 || c1 === c2 || Math.abs(dR) === Math.abs(dC);
  if (!straight) return null;
  const steps = Math.max(Math.abs(dR), Math.abs(dC));
  const sr = Math.sign(dR);
  const sc = Math.sign(dC);
  const cells: Cell[] = [];
  for (let i = 0; i <= steps; i++) cells.push([r1 + sr * i, c1 + sc * i]);
  return cells;
}

const key = (r: number, c: number) => `${r}-${c}`;

/** Find the placement whose cells exactly match the selected cell set. */
export function matchPlacement(cells: Cell[], puzzle: StrandsPuzzle) {
  const sel = new Set(cells.map(([r, c]) => key(r, c)));
  return (
    puzzle.placements.find((p) => {
      if (p.cells.length !== sel.size) return false;
      return p.cells.every(([r, c]) => sel.has(key(r, c)));
    }) ?? null
  );
}
