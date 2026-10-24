/**
 * Sudoku play state: entries, notes, mistakes, undo/redo and the order cells
 * were solved in (for the share card). Pure reducer, unit-tested in
 * tests/unit/sudoku-state.test.ts.
 */
import type { Grid } from "@/lib/games/sudoku";

export const MAX_MISTAKES = 3;
export const MAX_HINTS = 3;
const HISTORY_LIMIT = 300;

export interface PlayState {
  puzzle: Grid;
  solution: Grid;
  /** Player entries (0 = empty); givens live in `puzzle` only. */
  values: number[];
  /** 9-bit candidate masks the player pencilled in. */
  notes: number[];
  mistakes: number;
  hints: number;
  /** 1-based order each cell was correctly filled in (0 = not yet / given). */
  order: number[];
  /** Elapsed ms when each cell was correctly filled. */
  placedAt: number[];
  /** Cells the coach filled in. */
  coached: number[];
  past: Snapshot[];
  future: Snapshot[];
}

interface Snapshot {
  values: number[];
  notes: number[];
}

export type Action =
  | { type: "input"; cell: number; digit: number; at: number }
  | { type: "note"; cell: number; digit: number }
  | { type: "erase"; cell: number }
  | { type: "coach-place"; cell: number; digit: number; at: number }
  | { type: "hint-used" }
  | { type: "undo" }
  | { type: "redo" };

export function initialState(puzzle: Grid, solution: Grid): PlayState {
  return {
    puzzle,
    solution,
    values: Array(81).fill(0),
    notes: Array(81).fill(0),
    mistakes: 0,
    hints: 0,
    order: Array(81).fill(0),
    placedAt: Array(81).fill(0),
    coached: [],
    past: [],
    future: [],
  };
}

const ROW = (c: number) => Math.floor(c / 9);
const COL = (c: number) => c % 9;
const BOX = (c: number) => Math.floor(ROW(c) / 3) * 3 + Math.floor(COL(c) / 3);

export function peers(cell: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (i !== cell && (ROW(i) === ROW(cell) || COL(i) === COL(cell) || BOX(i) === BOX(cell))) out.push(i);
  }
  return out;
}

/** The grid as the player sees it: givens plus entries (wrong ones included). */
export function currentGrid(s: PlayState): Grid {
  return s.puzzle.map((g, i) => g || s.values[i]);
}

export function isComplete(s: PlayState): boolean {
  return s.puzzle.every((g, i) => g || s.values[i] === s.solution[i]);
}

function snapshot(s: PlayState): Snapshot {
  return { values: s.values, notes: s.notes };
}

function withHistory(s: PlayState, next: Partial<PlayState>): PlayState {
  return { ...s, ...next, past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [] };
}

function place(s: PlayState, cell: number, digit: number, at: number, coached: boolean): PlayState {
  const values = s.values.slice();
  values[cell] = digit;
  const correct = digit === s.solution[cell];
  const notes = s.notes.slice();
  notes[cell] = 0;
  if (correct) for (const p of peers(cell)) notes[p] &= ~(1 << (digit - 1));
  const order = s.order.slice();
  const placedAt = s.placedAt.slice();
  if (correct && !order[cell]) {
    order[cell] = Math.max(0, ...order) + 1;
    placedAt[cell] = at;
  }
  return withHistory(s, {
    values,
    notes,
    order,
    placedAt,
    mistakes: s.mistakes + (correct || coached ? 0 : 1),
    coached: coached ? [...s.coached, cell] : s.coached,
  });
}

export function reducer(s: PlayState, a: Action): PlayState {
  switch (a.type) {
    case "input": {
      if (s.puzzle[a.cell] || s.values[a.cell] === a.digit) return s;
      // A correct entry is final: it can't be overwritten by a slip of the finger.
      if (s.values[a.cell] === s.solution[a.cell]) return s;
      return place(s, a.cell, a.digit, a.at, false);
    }
    case "coach-place":
      if (s.puzzle[a.cell] || s.values[a.cell] === a.digit) return s;
      return place(s, a.cell, a.digit, a.at, true);
    case "note": {
      if (s.puzzle[a.cell] || s.values[a.cell]) return s;
      const notes = s.notes.slice();
      notes[a.cell] ^= 1 << (a.digit - 1);
      return withHistory(s, { notes });
    }
    case "erase": {
      if (s.puzzle[a.cell] || (!s.values[a.cell] && !s.notes[a.cell])) return s;
      if (s.values[a.cell] && s.values[a.cell] === s.solution[a.cell]) return s;
      const values = s.values.slice();
      const notes = s.notes.slice();
      values[a.cell] = 0;
      notes[a.cell] = 0;
      return withHistory(s, { values, notes });
    }
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, ...prev, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future] };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1) };
    }
  }
}

/** Remaining count per digit 1..9 (index 0 unused). */
export function remaining(s: PlayState): number[] {
  const left = Array(10).fill(9);
  currentGrid(s).forEach((v, i) => {
    if (v && (s.puzzle[i] || v === s.solution[i])) left[v]--;
  });
  return left;
}

/** Share-card map: "0" for givens, "1".."4" for solve-order quartiles (earliest = 1). */
export function solveOrderMap(s: PlayState): string {
  const filled = s.order.filter(Boolean).length || 1;
  return s.puzzle
    .map((g, i) => {
      if (g) return "0";
      const o = s.order[i];
      if (!o) return "4";
      return String(Math.min(4, 1 + Math.floor(((o - 1) / filled) * 4)));
    })
    .join("");
}
