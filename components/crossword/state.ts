/**
 * Crossword play state: letters (ink or pencil), check/reveal marks, help
 * counts and when each answer was completed. Pure reducer built per grid,
 * unit-tested in tests/unit/crossword-state.test.ts.
 */
import { entriesOf, isBlack, type Entry } from "@/lib/games/crossword";

export const MAX_HINTS = 3;

/** Per-cell mark: none, checked and wrong, revealed, checked and right. */
export const MARK = { none: 0, wrong: 1, revealed: 2, right: 3 } as const;

export interface PlayState {
  /** The player's letter per cell ("" = empty; black cells stay ""). */
  values: string[];
  pencil: boolean[];
  marks: number[];
  /** Coach hints opened. */
  hints: number;
  /** Check and reveal actions (each counts as a hint in the result). */
  assists: number;
  /** Wrong letters found by checks. */
  wrong: number;
  usedPencil: boolean;
  /** Elapsed ms when each entry ("12A") was first completed correctly. */
  doneAt: Record<string, number>;
}

export type Action =
  | { type: "input"; cell: number; letter: string; pencil: boolean; at: number }
  | { type: "erase"; cell: number }
  | { type: "check"; cells: number[] }
  | { type: "reveal"; cells: number[]; at: number }
  | { type: "coach-reveal"; cell: number; at: number }
  | { type: "hint-used" };

export function initialState(grid: string): PlayState {
  return {
    values: [...grid].map(() => ""),
    pencil: [...grid].map(() => false),
    marks: [...grid].map(() => 0),
    hints: 0,
    assists: 0,
    wrong: 0,
    usedPencil: false,
    doneAt: {},
  };
}

export const locked = (s: PlayState, i: number) => s.marks[i] === MARK.revealed || s.marks[i] === MARK.right;

export function isComplete(grid: string, s: PlayState): boolean {
  for (let i = 0; i < grid.length; i++) if (!isBlack(grid, i) && s.values[i] !== grid[i]) return false;
  return true;
}

export function isFull(grid: string, s: PlayState): boolean {
  for (let i = 0; i < grid.length; i++) if (!isBlack(grid, i) && !s.values[i]) return false;
  return true;
}

/** The reducer for one grid (entries are computed once). */
export function makeReducer(grid: string) {
  const entries = entriesOf(grid);
  const byCell = new Map<number, Entry[]>();
  for (const e of entries) for (const c of e.cells) byCell.set(c, [...(byCell.get(c) ?? []), e]);

  /** Record completion time for entries through `cells` that just became right. */
  const stamp = (s: PlayState, cells: number[], at: number): PlayState => {
    let doneAt = s.doneAt;
    for (const c of cells) {
      for (const e of byCell.get(c) ?? []) {
        if (doneAt[e.id] || !e.cells.every((i) => s.values[i] === grid[i])) continue;
        doneAt = { ...doneAt, [e.id]: Math.max(1, at) };
      }
    }
    return doneAt === s.doneAt ? s : { ...s, doneAt };
  };

  return function reducer(s: PlayState, a: Action): PlayState {
    switch (a.type) {
      case "input": {
        const letter = a.letter.toLowerCase();
        if (isBlack(grid, a.cell) || locked(s, a.cell) || !/^[a-z]$/.test(letter)) return s;
        if (s.values[a.cell] === letter && s.pencil[a.cell] === a.pencil) return s;
        const values = s.values.slice();
        const pencil = s.pencil.slice();
        const marks = s.marks.slice();
        values[a.cell] = letter;
        pencil[a.cell] = a.pencil;
        marks[a.cell] = MARK.none;
        return stamp({ ...s, values, pencil, marks, usedPencil: s.usedPencil || a.pencil }, [a.cell], a.at);
      }
      case "erase": {
        if (isBlack(grid, a.cell) || locked(s, a.cell) || !s.values[a.cell]) return s;
        const values = s.values.slice();
        const marks = s.marks.slice();
        values[a.cell] = "";
        marks[a.cell] = MARK.none;
        return { ...s, values, marks };
      }
      case "check": {
        const marks = s.marks.slice();
        let wrong = 0;
        for (const i of a.cells) {
          if (isBlack(grid, i) || !s.values[i] || locked(s, i)) continue;
          if (s.values[i] === grid[i]) marks[i] = MARK.right;
          else {
            marks[i] = MARK.wrong;
            wrong++;
          }
        }
        return { ...s, marks, assists: s.assists + 1, wrong: s.wrong + wrong };
      }
      case "reveal":
      case "coach-reveal": {
        const cells = a.type === "reveal" ? a.cells : [a.cell];
        const values = s.values.slice();
        const pencil = s.pencil.slice();
        const marks = s.marks.slice();
        let changed = false;
        for (const i of cells) {
          if (isBlack(grid, i) || (s.values[i] === grid[i] && locked(s, i))) continue;
          if (s.values[i] === grid[i] && !s.pencil[i]) {
            // Already right: just lock it.
            marks[i] = MARK.right;
            continue;
          }
          values[i] = grid[i];
          pencil[i] = false;
          marks[i] = MARK.revealed;
          changed = true;
        }
        const next = { ...s, values, pencil, marks, assists: s.assists + (a.type === "reveal" ? 1 : 0) };
        return changed ? stamp(next, cells, a.at) : next;
      }
      case "hint-used":
        return { ...s, hints: s.hints + 1 };
    }
  };
}

/** Total help for the result: coach hints plus check/reveal actions. */
export const helpCount = (s: PlayState) => s.hints + s.assists;

/** Share-card map: 0 black, 1 solved by the player, 2 revealed. */
export function shareMap(grid: string, s: PlayState): string {
  return [...grid].map((ch, i) => (ch === "#" ? "0" : s.marks[i] === MARK.revealed ? "2" : "1")).join("");
}

/** Skills this solve exercised (lib/games/kit/achievements.ts SKILL_TREES.crossword). */
export function solveSkills(grid: string, size: number, s: PlayState, timeMs: number): string[] {
  const out = new Set<string>([`grid-${size}`]);
  const helpedCell = (i: number) => s.marks[i] === MARK.revealed;
  if (entriesOf(grid).some((e) => e.cells.length >= 9 && !e.cells.some(helpedCell))) out.add("long-entry");
  if (!helpCount(s)) out.add("clean");
  if (size === 11 && timeMs < 8 * 60_000) out.add("quick");
  if (size >= 13 && !s.usedPencil && !s.assists) out.add("ink");
  return [...out];
}
