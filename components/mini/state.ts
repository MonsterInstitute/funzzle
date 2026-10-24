/**
 * Mini Crossword play state: letters, check / reveal, coach reveals, and the
 * order cells were solved in (share card), plus the cursor rules (auto-advance,
 * backspace, arrows, next clue). Pure functions, unit-tested in
 * tests/unit/mini-crossword-state.test.ts.
 */
import type { Layout } from "@/lib/games/mini";

/** Coach hints per puzzle before the opt-in rewarded "one more hint". */
export const MAX_HINTS = 3;

export interface PlayState {
  /** Solution letter per cell ("" = black). */
  solution: string[];
  /** Player letters ("" = empty). */
  values: string[];
  /** Cells filled by Reveal or the coach: locked, marked. */
  revealed: boolean[];
  /** Cells the last Check found wrong (cleared when the letter changes). */
  wrong: boolean[];
  /** Every kind of help: checks, reveals and coach hints. */
  hints: number;
  /** Coach hints opened (capped at MAX_HINTS + bonus). */
  coachHints: number;
  checks: number;
  reveals: number;
  /** Wrong letters a Check turned up. */
  mistakes: number;
  /** 1-based order each cell first became right (0 = not yet / black). */
  order: number[];
  /** Elapsed ms when each cell first became right. */
  placedAt: number[];
}

export type Action =
  | { type: "input"; cell: number; letter: string; at: number }
  | { type: "erase"; cell: number }
  | { type: "check"; cells: number[] }
  | { type: "reveal"; cells: number[]; at: number; coach?: boolean }
  | { type: "hint-used" };

export function initialState(solution: string[]): PlayState {
  const n = solution.length;
  return {
    solution,
    values: Array(n).fill(""),
    revealed: Array(n).fill(false),
    wrong: Array(n).fill(false),
    hints: 0,
    coachHints: 0,
    checks: 0,
    reveals: 0,
    mistakes: 0,
    order: Array(n).fill(0),
    placedAt: Array(n).fill(0),
  };
}

const open = (s: PlayState, i: number) => s.solution[i] !== "";

export function isComplete(s: PlayState): boolean {
  return s.solution.every((x, i) => !x || s.values[i] === x);
}

export function isFull(s: PlayState): boolean {
  return s.solution.every((x, i) => !x || s.values[i] !== "");
}

/** Solved without Check, Reveal or the coach. */
export const isClean = (s: PlayState) => s.hints === 0;

function setLetters(s: PlayState, cells: number[], letters: string[], at: number, reveal: boolean): PlayState {
  const values = s.values.slice();
  const wrong = s.wrong.slice();
  const revealed = reveal ? s.revealed.slice() : s.revealed;
  const order = s.order.slice();
  const placedAt = s.placedAt.slice();
  let next = Math.max(0, ...order);
  cells.forEach((i, k) => {
    values[i] = letters[k];
    wrong[i] = false;
    if (reveal) revealed[i] = true;
    if (letters[k] === s.solution[i] && !order[i]) {
      order[i] = ++next;
      placedAt[i] = at;
    }
  });
  return { ...s, values, wrong, revealed, order, placedAt };
}

export function reducer(s: PlayState, a: Action): PlayState {
  switch (a.type) {
    case "input": {
      if (!open(s, a.cell) || s.revealed[a.cell]) return s;
      const letter = a.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter) || s.values[a.cell] === letter) return s;
      return setLetters(s, [a.cell], [letter], a.at, false);
    }
    case "erase": {
      if (!open(s, a.cell) || s.revealed[a.cell] || !s.values[a.cell]) return s;
      const values = s.values.slice();
      const wrong = s.wrong.slice();
      values[a.cell] = "";
      wrong[a.cell] = false;
      return { ...s, values, wrong };
    }
    case "check": {
      const cells = a.cells.filter((i) => open(s, i) && s.values[i] && !s.revealed[i]);
      const wrong = s.wrong.slice();
      let found = 0;
      for (const i of cells) {
        const bad = s.values[i] !== s.solution[i];
        if (bad && !wrong[i]) found++;
        wrong[i] = bad;
      }
      return { ...s, wrong, checks: s.checks + 1, hints: s.hints + 1, mistakes: s.mistakes + found };
    }
    case "reveal": {
      const cells = a.cells.filter((i) => open(s, i) && s.values[i] !== s.solution[i]);
      if (!cells.length) return s;
      const next = setLetters(s, cells, cells.map((i) => s.solution[i]), a.at, true);
      // Coach reveals were already counted when the hint opened.
      return a.coach ? next : { ...next, reveals: s.reveals + 1, hints: s.hints + 1 };
    }
    case "hint-used":
      return { ...s, coachHints: s.coachHints + 1, hints: s.hints + 1 };
  }
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

export interface Cursor {
  cell: number;
  /** 0 = across, 1 = down. */
  dir: 0 | 1;
}

/** The entry (index into layout.entries) the cursor is in, falling back to the other direction. */
export function entryAt(L: Layout, c: Cursor): number {
  const pair = L.cellEntries[c.cell];
  return pair[c.dir] >= 0 ? pair[c.dir] : pair[1 - c.dir];
}

/** A cursor whose direction matches the entry it ends up in. */
export function normalize(L: Layout, c: Cursor): Cursor {
  const pair = L.cellEntries[c.cell];
  return pair[c.dir] >= 0 ? c : { cell: c.cell, dir: (1 - c.dir) as 0 | 1 };
}

export function firstCursor(L: Layout): Cursor {
  return { cell: L.entries[0].cells[0], dir: 0 };
}

const dirOf = (L: Layout, idx: number): 0 | 1 => (L.entries[idx].dir === "A" ? 0 : 1);

/** First empty cell of an entry, or its first cell. */
export function entryStart(L: Layout, values: string[], idx: number): Cursor {
  const e = L.entries[idx];
  return { cell: e.cells.find((i) => !values[i]) ?? e.cells[0], dir: dirOf(L, idx) };
}

/**
 * After typing at `c` (`values` already include the new letter): the next
 * empty cell of the same entry (wrapping); in a full entry the next cell; at
 * the end of a full entry the first gap of the next entry with one.
 */
export function afterType(L: Layout, values: string[], c: Cursor): Cursor {
  const idx = entryAt(L, c);
  const cells = L.entries[idx].cells;
  const pos = cells.indexOf(c.cell);
  const dir = dirOf(L, idx);
  for (let k = pos + 1; k < cells.length; k++) if (!values[cells[k]]) return { cell: cells[k], dir };
  for (let k = 0; k < pos; k++) if (!values[cells[k]]) return { cell: cells[k], dir };
  // Entry full: keep going through it (fixing a letter), then on to the next
  // entry that still has a gap.
  if (pos < cells.length - 1) return { cell: cells[pos + 1], dir };
  const n = L.entries.length;
  for (let k = 1; k <= n; k++) {
    const j = (idx + k) % n;
    if (L.entries[j].cells.some((i) => !values[i])) return entryStart(L, values, j);
  }
  return { cell: cells[Math.min(pos + 1, cells.length - 1)], dir };
}

/** Backspace target: stay when the cell has a letter, else step back one cell. */
export function backTarget(L: Layout, values: string[], c: Cursor): Cursor {
  if (values[c.cell]) return c;
  const idx = entryAt(L, c);
  const cells = L.entries[idx].cells;
  const pos = cells.indexOf(c.cell);
  return pos > 0 ? { cell: cells[pos - 1], dir: dirOf(L, idx) } : c;
}

/** Arrow keys: move to the next open cell that way; a perpendicular arrow first turns the cursor. */
export function arrow(L: Layout, c: Cursor, dr: number, dc: number): Cursor {
  const want: 0 | 1 = dr ? 1 : 0;
  if (want !== c.dir && L.cellEntries[c.cell][want] >= 0) return { cell: c.cell, dir: want };
  let r = Math.floor(c.cell / L.size);
  let col = c.cell % L.size;
  for (;;) {
    r += dr;
    col += dc;
    if (r < 0 || col < 0 || r >= L.size || col >= L.size) return c;
    const i = r * L.size + col;
    if (!L.black[i]) return normalize(L, { cell: i, dir: want });
  }
}

/** Next / previous clue (Tab, Shift+Tab, the clue bar arrows), to its first empty cell. */
export function stepEntry(L: Layout, values: string[], c: Cursor, delta: 1 | -1): Cursor {
  const n = L.entries.length;
  const idx = entryAt(L, c);
  return entryStart(L, values, (idx + delta + n) % n);
}

/** Share-card map: "0" black, "1".."4" solve-order quartile (earliest = 1), "5" revealed. */
export function solveOrderMap(s: PlayState): string {
  const filled = s.order.filter(Boolean).length || 1;
  return s.solution
    .map((x, i) => {
      if (!x) return "0";
      if (s.revealed[i]) return "5";
      const o = s.order[i];
      if (!o) return "4";
      return String(Math.min(4, 1 + Math.floor(((o - 1) / filled) * 4)));
    })
    .join("");
}
