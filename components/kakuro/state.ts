/**
 * Kakuro play state: entries, pencil marks, mistakes, undo/redo and the order
 * cells were solved in. Pure reducer, unit-tested in
 * tests/unit/kakuro-state.test.ts. Mirrors components/sudoku/state.ts, with
 * "peers" being the cells that share a run.
 */
import { buildBoard, type Board } from "@/lib/games/kakuro";

export const MAX_MISTAKES = 3;
export const MAX_HINTS = 3;
const HISTORY_LIMIT = 300;

export interface KakuroGrid {
  size: number;
  layout: string;
  across: number[];
  down: number[];
  solution: number[];
}

export interface PlayState extends KakuroGrid {
  /** Player entries (0 = empty). */
  values: number[];
  /** 9-bit pencil-mark masks. */
  notes: number[];
  mistakes: number;
  hints: number;
  /** 1-based order each cell was correctly filled in (0 = not yet). */
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

const boards = new Map<string, Board>();

/** The board for a grid, built once per layout and clue set. */
export function boardFor(g: KakuroGrid): Board {
  const key = `${g.layout}|${g.across.join(",")}|${g.down.join(",")}`;
  let b = boards.get(key);
  if (!b) {
    b = buildBoard(g.size, g.layout.split("").map((ch) => ch === "."), g.across, g.down);
    boards.set(key, b);
    if (boards.size > 8) boards.delete(boards.keys().next().value!);
  }
  return b;
}

export function initialState(g: KakuroGrid): PlayState {
  const n = g.layout.length;
  return {
    size: g.size,
    layout: g.layout,
    across: g.across,
    down: g.down,
    solution: g.solution,
    values: Array(n).fill(0),
    notes: Array(n).fill(0),
    mistakes: 0,
    hints: 0,
    order: Array(n).fill(0),
    placedAt: Array(n).fill(0),
    coached: [],
    past: [],
    future: [],
  };
}

export const isWhite = (s: KakuroGrid, i: number) => s.layout[i] === ".";

/** Cells sharing a run with `cell` (it can't repeat a digit any of them hold). */
export function peers(s: KakuroGrid, cell: number): number[] {
  const b = boardFor(s);
  const out = new Set<number>();
  for (const r of b.runOf[cell] ?? []) if (r >= 0) for (const j of b.runs[r].cells) if (j !== cell) out.add(j);
  return [...out];
}

export function isComplete(s: PlayState): boolean {
  return s.solution.every((d, i) => !isWhite(s, i) || s.values[i] === d);
}

/** A run whose cells are all filled, distinct and add up to its clue (its clue dims). */
export function runDone(s: PlayState, runId: number): boolean {
  const run = boardFor(s).runs[runId];
  const ds = run.cells.map((i) => s.values[i]);
  return ds.every(Boolean) && new Set(ds).size === ds.length && ds.reduce((a, b) => a + b, 0) === run.sum;
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
  if (correct) for (const p of peers(s, cell)) notes[p] &= ~(1 << (digit - 1));
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
      if (!isWhite(s, a.cell) || s.values[a.cell] === a.digit) return s;
      // A correct entry is final: it can't be overwritten by a slip of the finger.
      if (s.values[a.cell] === s.solution[a.cell]) return s;
      return place(s, a.cell, a.digit, a.at, false);
    }
    case "coach-place":
      if (!isWhite(s, a.cell) || s.values[a.cell] === a.digit) return s;
      return place(s, a.cell, a.digit, a.at, true);
    case "note": {
      if (!isWhite(s, a.cell) || s.values[a.cell]) return s;
      const notes = s.notes.slice();
      notes[a.cell] ^= 1 << (a.digit - 1);
      return withHistory(s, { notes });
    }
    case "erase": {
      if (!isWhite(s, a.cell) || (!s.values[a.cell] && !s.notes[a.cell])) return s;
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

/** Next white cell from `cell` in a direction (skipping clue cells), or `cell` at the edge. */
export function moveCursor(s: KakuroGrid, cell: number, dr: number, dc: number): number {
  const W = s.size + 1;
  let r = Math.floor(cell / W);
  let c = cell % W;
  for (;;) {
    r += dr;
    c += dc;
    if (r < 1 || c < 1 || r > s.size || c > s.size) return cell;
    if (isWhite(s, r * W + c)) return r * W + c;
  }
}

/** Empty white cells left. */
export function emptyCells(s: PlayState): number {
  let n = 0;
  for (let i = 0; i < s.values.length; i++) if (isWhite(s, i) && s.values[i] !== s.solution[i]) n++;
  return n;
}
