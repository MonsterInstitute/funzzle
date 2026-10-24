/**
 * Play state for the grid modes (classic, quad, math): typing, submitting
 * with validation, coach hints and revealed letters. Pure, so it's unit
 * tested (tests/unit/word-state.test.ts).
 */
import { hardModeViolation, isGuessWord, score, validateEquation, type GridMode, type Mark, type Reveal } from "@/lib/games/word";
import type { KeyState } from "./ui";

export { MAX_HINTS } from "@/lib/games/word/modes";

export interface GridState {
  mode: GridMode;
  answers: string[];
  rows: number;
  length: number;
  guesses: string[];
  /** Elapsed ms when each guess went in (for the recap). */
  guessAt: number[];
  current: string;
  hints: number;
  reveals: Reveal[];
  hard: boolean;
  /** Why the last submit was rejected; `rejected` bumps so the row can shake again. */
  message: string | null;
  rejected: number;
}

export type GridAction =
  | { type: "type"; ch: string }
  | { type: "back" }
  | { type: "submit"; at: number }
  | { type: "fill"; guess: string }
  | { type: "hint-used" }
  | { type: "reveal"; reveal: Reveal }
  | { type: "hard"; on: boolean }
  | { type: "dismiss" };

export function initialGrid(mode: GridMode, answers: string[], hard = false): GridState {
  return {
    mode,
    answers,
    rows: mode === "quad" ? 9 : 6,
    length: answers[0].length,
    guesses: [],
    guessAt: [],
    current: "",
    hints: 0,
    reveals: [],
    hard: mode === "classic" && hard,
    message: null,
    rejected: 0,
  };
}

/** Index of the guess that solved each board, or -1. */
export function solvedAt(s: Pick<GridState, "answers" | "guesses">): number[] {
  return s.answers.map((a) => s.guesses.indexOf(a));
}

export function status(s: GridState): "playing" | "won" | "lost" {
  if (solvedAt(s).every((i) => i >= 0)) return "won";
  return s.guesses.length >= s.rows ? "lost" : "playing";
}

/** Marks of every guess on a board, up to the guess that solved it. */
export function boardMarks(s: Pick<GridState, "answers" | "guesses">, board: number): Mark[][] {
  const answer = s.answers[board];
  const out: Mark[][] = [];
  for (const g of s.guesses) {
    out.push(score(g, answer));
    if (g === answer) break;
  }
  return out;
}

export function allowedChar(mode: GridMode, ch: string): boolean {
  return mode === "math" ? /^[0-9+\-*/=]$/.test(ch) : /^[a-z]$/.test(ch);
}

/** Why `guess` can't be played, or null. */
export function rejectReason(s: GridState, guess: string): string | null {
  if (guess.length < s.length) return s.mode === "math" ? `Fill all ${s.length} spots` : "Not enough letters";
  if (s.mode === "math") return validateEquation(guess);
  if (!isGuessWord(guess)) return "Not in the word list";
  if (s.hard) {
    const clues = s.guesses.map((g) => ({ guess: g, marks: score(g, s.answers[0]) }));
    const why = hardModeViolation(guess, clues);
    if (why) return `Hard mode: ${why}`;
  }
  return null;
}

export function reducer(s: GridState, a: GridAction): GridState {
  const playing = status(s) === "playing";
  switch (a.type) {
    case "type": {
      const ch = a.ch.toLowerCase();
      if (!playing || s.current.length >= s.length || !allowedChar(s.mode, ch)) return s;
      return { ...s, current: s.current + ch, message: null };
    }
    case "back":
      return playing ? { ...s, current: s.current.slice(0, -1), message: null } : s;
    case "fill":
      return playing ? { ...s, current: a.guess.slice(0, s.length), message: null } : s;
    case "submit": {
      if (!playing) return s;
      const why = rejectReason(s, s.current);
      if (why) return { ...s, message: why, rejected: s.rejected + 1 };
      return { ...s, guesses: [...s.guesses, s.current], guessAt: [...s.guessAt, a.at], current: "", message: null };
    }
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "reveal":
      return s.reveals.some((r) => r.board === a.reveal.board && r.pos === a.reveal.pos) ? s : { ...s, reveals: [...s.reveals, a.reveal] };
    case "hard":
      // Hard mode can only change before the first guess.
      return s.mode === "classic" && !s.guesses.length ? { ...s, hard: a.on } : s;
    case "dismiss":
      return { ...s, message: null };
  }
}

/** Best-known state of each key on a board (-1 = not tried). */
export function keyStates(s: Pick<GridState, "answers" | "guesses">, board: number): Map<string, KeyState> {
  const map = new Map<string, KeyState>();
  const marks = boardMarks(s, board);
  marks.forEach((row, gi) => {
    const g = s.guesses[gi];
    row.forEach((m, i) => {
      const prev = map.get(g[i]) ?? -1;
      if (m > prev) map.set(g[i], m);
    });
  });
  return map;
}
