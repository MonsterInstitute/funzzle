/**
 * Nonogram play state: marks (filled / crossed), mistakes, hints and
 * undo/redo. Pure reducer and helpers, unit-tested in
 * tests/unit/nonogram-state.test.ts.
 */
import { EMPTY, FILLED, UNKNOWN, clueOf, type Clues, type LineRef } from "@/lib/games/nonogram";

export const MAX_HINTS = 3;
const HISTORY_LIMIT = 300;

export type Mode = "fill" | "cross";

export interface PlayState {
  size: number;
  /** Row-major, 1 = filled. */
  solution: number[];
  clues: Clues;
  /** UNKNOWN / FILLED / EMPTY (crossed off) per cell. */
  cells: number[];
  mistakes: number;
  hints: number;
  /** Cells the coach marked. */
  coached: number[];
  past: number[][];
  future: number[][];
}

export type Action =
  | { type: "paint"; cells: number[]; value: number }
  | { type: "coach"; fill: number[]; empty: number[] }
  | { type: "hint-used" }
  | { type: "undo" }
  | { type: "redo" };

export function initialState(size: number, solution: number[], clues: Clues): PlayState {
  return { size, solution, clues, cells: new Array(size * size).fill(UNKNOWN), mistakes: 0, hints: 0, coached: [], past: [], future: [] };
}

/** A mark that disagrees with the picture. */
export const isWrong = (s: Pick<PlayState, "solution">, i: number, v: number) => (v === FILLED && !s.solution[i]) || (v === EMPTY && s.solution[i] === 1);

/** Solved when exactly the picture's cells are filled (crosses are optional). */
export function isComplete(s: PlayState): boolean {
  return s.cells.every((v, i) => (v === FILLED) === (s.solution[i] === 1));
}

export const lineIndices = (ref: LineRef, size: number) =>
  Array.from({ length: size }, (_, k) => (ref.kind === "row" ? ref.index * size + k : k * size + ref.index));

/** A line whose filled cells already match its clue (the clue dims). */
export function lineDone(s: PlayState, ref: LineRef): boolean {
  const clue = ref.kind === "row" ? s.clues.rows[ref.index] : s.clues.cols[ref.index];
  return clueOf(lineIndices(ref, s.size).map((i) => s.cells[i])).join() === clue.join();
}

/** What a tap or stroke starting on a cell does in this mode: mark it, or clear that mark. */
export function strokeValue(mode: Mode, current: number): number {
  if (mode === "fill") return current === FILLED ? UNKNOWN : FILLED;
  return current === EMPTY ? UNKNOWN : EMPTY;
}

/**
 * Cells a drag from `start` to `end` covers: locked to the start's row or
 * column (whichever the drag moved along more), start to end inclusive.
 */
export function strokeLine(start: number, end: number, size: number): number[] {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const r1 = Math.floor(end / size);
  const c1 = end % size;
  const out: number[] = [];
  if (Math.abs(c1 - c0) >= Math.abs(r1 - r0)) {
    const step = c1 >= c0 ? 1 : -1;
    for (let c = c0; c !== c1 + step; c += step) out.push(r0 * size + c);
  } else {
    const step = r1 >= r0 ? 1 : -1;
    for (let r = r0; r !== r1 + step; r += step) out.push(r * size + c0);
  }
  return out;
}

/**
 * The cells a stroke actually changes. Marking only paints blank cells (it
 * never overwrites the other kind of mark); clearing only clears the kind of
 * mark the stroke started on. The start cell always counts.
 */
export function strokeTargets(cells: number[], line: number[], value: number): number[] {
  if (!line.length) return [];
  const startValue = cells[line[0]];
  return line.filter((i, k) => {
    if (cells[i] === value) return false;
    if (k === 0) return true;
    return value === UNKNOWN ? cells[i] === startValue : cells[i] === UNKNOWN;
  });
}

function withHistory(s: PlayState, cells: number[], extra: Partial<PlayState> = {}): PlayState {
  return { ...s, ...extra, cells, past: [...s.past, s.cells].slice(-HISTORY_LIMIT), future: [] };
}

export function reducer(s: PlayState, a: Action): PlayState {
  switch (a.type) {
    case "paint": {
      const changed = a.cells.filter((i) => s.cells[i] !== a.value);
      if (!changed.length) return s;
      const cells = s.cells.slice();
      let mistakes = s.mistakes;
      for (const i of changed) {
        cells[i] = a.value;
        if (isWrong(s, i, a.value)) mistakes++;
      }
      return withHistory(s, cells, { mistakes });
    }
    case "coach": {
      const cells = s.cells.slice();
      for (const i of a.fill) cells[i] = FILLED;
      for (const i of a.empty) cells[i] = EMPTY;
      const touched = [...a.fill, ...a.empty];
      return withHistory(s, cells, { coached: [...s.coached, ...touched.filter((i) => !s.coached.includes(i))] });
    }
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "undo": {
      const prev = s.past.at(-1);
      if (!prev) return s;
      return { ...s, cells: prev, past: s.past.slice(0, -1), future: [s.cells, ...s.future] };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return { ...s, cells: next, past: [...s.past, s.cells], future: s.future.slice(1) };
    }
  }
}

/** Filled cells still to find (for the progress line). */
export function remainingFills(s: PlayState): number {
  return s.solution.reduce((n, v, i) => n + (v === 1 && s.cells[i] !== FILLED ? 1 : 0), 0);
}
