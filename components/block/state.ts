/**
 * Block Puzzle screen helpers (pure, unit-tested in tests/unit/block-puzzle-state.test.ts):
 * where a dragged piece lands, which lines a ghost would clear, and the
 * skills a finished game earned.
 */
import { canPlace, DAILY_PIECES, drop, fullLines, PIECES, SIZE, type State } from "@/lib/games/block";

/** Piece colors 1–6: mid-tones that read on the light and the dark board. */
export const PIECE_COLORS = ["", "#FF8A65", "#FFB547", "#4CC38A", "#5B9BFF", "#9C83FF", "#FF7EB0"];

/** How far above the finger a touch-dragged piece floats, in board cells. */
export const TOUCH_LIFT_CELLS = 1.4;

export interface Ghost {
  slot: number;
  row: number;
  col: number;
}

/**
 * The top-left of a dragged piece on screen. Touch lifts the piece above the
 * finger (so the finger never hides it); a mouse holds it by its center.
 */
export function liftedPosition(pieceId: string, x: number, y: number, cell: number, touch: boolean): { left: number; top: number } {
  const p = PIECES[pieceId];
  const w = p.w * cell;
  const h = p.h * cell;
  return touch ? { left: x - w / 2, top: y - h - TOUCH_LIFT_CELLS * cell } : { left: x - w / 2, top: y - h / 2 };
}

/**
 * The board cell a dragged piece snaps to: the nearest cell to its top-left,
 * or null when the piece would hang off the board.
 */
export function snapAnchor(pieceId: string, left: number, top: number, board: { left: number; top: number; cell: number }): { row: number; col: number } | null {
  const p = PIECES[pieceId];
  const col = Math.round((left - board.left) / board.cell);
  const row = Math.round((top - board.top) / board.cell);
  if (row < 0 || col < 0 || row + p.h > SIZE || col + p.w > SIZE) return null;
  return { row, col };
}

/** Anchor that centers the piece on a tapped cell, kept on the board. */
export function centeredAnchor(pieceId: string, row: number, col: number): { row: number; col: number } {
  const p = PIECES[pieceId];
  return {
    row: Math.min(SIZE - p.h, Math.max(0, row - Math.floor((p.h - 1) / 2))),
    col: Math.min(SIZE - p.w, Math.max(0, col - Math.floor((p.w - 1) / 2))),
  };
}

/** Move an anchor with the arrow keys, kept on the board. */
export function nudge(pieceId: string, a: { row: number; col: number }, dRow: number, dCol: number): { row: number; col: number } {
  return clampAnchor(pieceId, a.row + dRow, a.col + dCol);
}

function clampAnchor(pieceId: string, row: number, col: number) {
  const p = PIECES[pieceId];
  return { row: Math.min(SIZE - p.h, Math.max(0, row)), col: Math.min(SIZE - p.w, Math.max(0, col)) };
}

/** First spot (reading order) where the piece fits, for keyboard selection. */
export function firstFit(board: number[], pieceId: string): { row: number; col: number } {
  const p = PIECES[pieceId];
  for (let r = 0; r + p.h <= SIZE; r++) for (let c = 0; c + p.w <= SIZE; c++) if (canPlace(board, pieceId, r, c)) return { row: r, col: c };
  return { row: 0, col: 0 };
}

/** Board cells a piece covers at an anchor. */
export function ghostCells(pieceId: string, row: number, col: number): number[] {
  return PIECES[pieceId].cells.map(([r, c]) => (row + r) * SIZE + col + c);
}

/** Rows and columns a placement would clear (empty if it doesn't fit). */
export function previewClears(board: number[], pieceId: string, row: number, col: number): { rows: number[]; cols: number[] } {
  const d = drop(board, pieceId, row, col);
  return d ? fullLines(d) : { rows: [], cols: [] };
}

/** Skill ids (lib/games/kit/achievements SKILL_TREES["block-puzzle"]) a finished game earned. */
export function skillsEarned(s: State, opts: { daily: boolean; hints: number }): string[] {
  return [
    ...(s.lines > 0 ? ["clear-line"] : []),
    ...(s.maxLines >= 2 ? ["double"] : []),
    ...(s.bestCombo >= 3 ? ["combo-3"] : []),
    ...(s.score >= 1000 ? ["score-1000"] : []),
    ...(opts.daily && s.placed >= DAILY_PIECES ? ["full-daily"] : []),
    ...(s.cleanBoard ? ["clean-board"] : []),
    ...(s.score >= 1500 && !opts.hints ? ["unaided"] : []),
  ];
}

/** "rows 2–3, columns 4–6" style position for screen readers. */
export function whereText(pieceId: string, row: number, col: number): string {
  const p = PIECES[pieceId];
  const rows = p.h === 1 ? `row ${row + 1}` : `rows ${row + 1} to ${row + p.h}`;
  const cols = p.w === 1 ? `column ${col + 1}` : `columns ${col + 1} to ${col + p.w}`;
  return `${rows}, ${cols}`;
}
