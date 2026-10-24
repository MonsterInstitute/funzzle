/**
 * Groups play state: selection, guesses, "one away", mistakes, coach reveals
 * and the order groups were found. Pure reducer, unit-tested in
 * tests/unit/groups-state.test.ts.
 */
import { createRng } from "@/lib/games/kit/rng";
import { groupOf, LEVEL_EMOJI, type GroupsPuzzle } from "@/lib/games/groups";

export const MAX_MISTAKES = 4;
export const MAX_HINTS = 3;

export type FeedbackKind = "correct" | "one-away" | "wrong" | "already";

export interface PlayState {
  puzzle: GroupsPuzzle;
  /** Unsolved words in board order. */
  board: string[];
  selected: string[];
  /** Group indices in the order they were found (coach reveals included). */
  solved: number[];
  /** Elapsed ms when each entry of `solved` was found. */
  solvedAt: number[];
  /** Groups the coach revealed. */
  coached: number[];
  /** Groups shown after running out of mistakes (not found). */
  revealed: number[];
  /** Every submitted four (plus the last group, completed automatically). */
  guesses: string[][];
  mistakes: number;
  hints: number;
  /** Last submit's outcome; `n` changes on every submit so the screen can react. */
  feedback: { kind: FeedbackKind; n: number } | null;
}

export type Action =
  | { type: "toggle"; word: string }
  | { type: "deselect" }
  | { type: "shuffle"; seed: number }
  | { type: "submit"; at: number }
  | { type: "coach-reveal"; group: number; at: number }
  | { type: "hint-used" };

export function initialState(puzzle: GroupsPuzzle, board: string[]): PlayState {
  return { puzzle, board, selected: [], solved: [], solvedAt: [], coached: [], revealed: [], guesses: [], mistakes: 0, hints: 0, feedback: null };
}

export const isWon = (s: PlayState) => s.solved.length === 4;
export const isLost = (s: PlayState) => s.mistakes >= MAX_MISTAKES && !isWon(s);
export const isOver = (s: PlayState) => isWon(s) || isLost(s);

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((w) => b.includes(w));

/** Mark group `g` found and take its words off the board; the last group then completes itself. */
function solve(s: PlayState, g: number, at: number, coached: boolean): PlayState {
  const words = s.puzzle.groups[g].words as string[];
  let next: PlayState = {
    ...s,
    board: s.board.filter((w) => !words.includes(w)),
    selected: s.selected.filter((w) => !words.includes(w)),
    solved: [...s.solved, g],
    solvedAt: [...s.solvedAt, at],
    coached: coached ? [...s.coached, g] : s.coached,
  };
  if (next.solved.length === 3) {
    const last = [0, 1, 2, 3].find((i) => !next.solved.includes(i))!;
    next = { ...next, board: [], selected: [], solved: [...next.solved, last], solvedAt: [...next.solvedAt, at], guesses: [...next.guesses, [...s.puzzle.groups[last].words]] };
  }
  return next;
}

export function reducer(s: PlayState, a: Action): PlayState {
  if (isOver(s)) return s;
  switch (a.type) {
    case "toggle": {
      if (!s.board.includes(a.word)) return s;
      if (s.selected.includes(a.word)) return { ...s, selected: s.selected.filter((w) => w !== a.word) };
      if (s.selected.length >= 4) return s;
      return { ...s, selected: [...s.selected, a.word] };
    }
    case "deselect":
      return s.selected.length ? { ...s, selected: [] } : s;
    case "shuffle":
      return { ...s, board: createRng(a.seed).shuffle(s.board.slice()) };
    case "submit": {
      if (s.selected.length !== 4) return s;
      const n = (s.feedback?.n ?? 0) + 1;
      if (s.guesses.some((g) => sameSet(g, s.selected))) return { ...s, feedback: { kind: "already", n } };
      // Keep the guess in board order, so the share squares read like the board.
      const guess = s.board.filter((w) => s.selected.includes(w));
      const withGuess = { ...s, guesses: [...s.guesses, guess] };
      const groups = guess.map((w) => groupOf(s.puzzle, w));
      if (groups.every((g) => g === groups[0])) return { ...solve(withGuess, groups[0], a.at, false), feedback: { kind: "correct", n } };
      const most = Math.max(...[0, 1, 2, 3].map((g) => groups.filter((x) => x === g).length));
      const mistakes = s.mistakes + 1;
      const next: PlayState = { ...withGuess, mistakes, feedback: { kind: most === 3 ? "one-away" : "wrong", n } };
      if (mistakes < MAX_MISTAKES) return next;
      // Out of mistakes: show the rest, easiest first.
      return { ...next, selected: [], board: [], revealed: [0, 1, 2, 3].filter((g) => !s.solved.includes(g)) };
    }
    case "coach-reveal":
      if (s.solved.includes(a.group)) return s;
      return { ...solve(s, a.group, a.at, true), feedback: null };
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
  }
}

/** Level digits of every guess, four per guess ("1111" + "2324" …), for the share card. */
export function guessMap(s: PlayState): string {
  return s.guesses.map((g) => g.map((w) => s.puzzle.groups[groupOf(s.puzzle, w)].level).join("")).join("");
}

/** Emoji rows of every guess for the copied result. */
export function guessRows(s: PlayState): string[] {
  return s.guesses.map((g) => g.map((w) => LEVEL_EMOJI[s.puzzle.groups[groupOf(s.puzzle, w)].level]).join(""));
}

/** Short progress line, e.g. "2 of 4 groups · 1 mistake". */
export function progressLine(s: PlayState): string {
  return `${s.solved.length} of 4 groups · ${s.mistakes} mistake${s.mistakes === 1 ? "" : "s"}`;
}
