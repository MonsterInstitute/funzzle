/**
 * Word Search play state: which words are found (and when), which the coach
 * circled, hints used. Pure reducer, unit-tested in
 * tests/unit/word-search-state.test.ts.
 */
import { DIR_SKILL, lineCells, matchSelection, type WordSearchPuzzle } from "@/lib/games/wordsearch";

export const MAX_HINTS = 3;

export interface PlayState {
  /** Elapsed ms when each word was found; 0 = not yet. */
  foundAt: number[];
  /** Words the coach circled (rung 3). */
  coached: boolean[];
  /** Word indexes in the order they were found. */
  order: number[];
  hints: number;
  /** Selections that matched no word (shown in the recap, never penalized). */
  misses: number;
}

export type Action =
  | { type: "select"; cells: number[]; at: number; puzzle: WordSearchPuzzle }
  | { type: "coach-find"; word: number; at: number }
  | { type: "hint-used" };

export function initialState(p: WordSearchPuzzle): PlayState {
  return { foundAt: p.words.map(() => 0), coached: p.words.map(() => false), order: [], hints: 0, misses: 0 };
}

const mark = (s: PlayState, word: number, at: number, coached: boolean): PlayState => {
  if (s.foundAt[word]) return s;
  const foundAt = s.foundAt.slice();
  foundAt[word] = Math.max(1, at);
  const c = s.coached.slice();
  c[word] = coached;
  return { ...s, foundAt, coached: c, order: [...s.order, word] };
};

export function reducer(s: PlayState, a: Action): PlayState {
  switch (a.type) {
    case "select": {
      if (a.cells.length < 2) return s;
      const word = matchSelection(a.puzzle, a.cells);
      if (word < 0) return { ...s, misses: s.misses + 1 };
      return mark(s, word, a.at, false);
    }
    case "coach-find":
      return mark(s, a.word, a.at, true);
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
  }
}

export const found = (s: PlayState) => s.foundAt.map((t) => t > 0);
export const foundCount = (s: PlayState) => s.foundAt.filter((t) => t > 0).length;
export const isComplete = (s: PlayState) => s.foundAt.every((t) => t > 0);

/** Cells from a drag's start to its current square, snapped to 8 directions. */
export const dragCells = (size: number, from: number, to: number) => lineCells(size, from, to);

/** Skills this solve exercised: directions found without the coach, plus unaided / big-grid / quick. */
export function solveSkills(p: WordSearchPuzzle, s: PlayState, timeMs: number): string[] {
  const out = new Set<string>();
  p.words.forEach((w, i) => {
    if (s.foundAt[i] && !s.coached[i]) out.add(DIR_SKILL[w.dir]);
  });
  if (!s.hints) out.add("unaided");
  if (p.size >= 15) out.add("big-grid");
  if (p.size >= 12 && timeMs < 240_000) out.add("quick");
  return [...out];
}
