/**
 * Spelling Hive play state: a pure reducer over the puzzle (it ships its own
 * word lists), so the browser never needs the lexicon.
 */
import { checkWord, isPangram, letterSet, rankIndex, REJECT_MESSAGE, scoreOf, TOP, type HivePuzzle } from "@/lib/games/hive";

export const MAX_HINTS = 3;
export const MAX_INPUT = 19;

export interface HiveMessage {
  text: string;
  tone: "good" | "pangram" | "bonus" | "bad";
  /** Bumped on every message, so the same text can show twice. */
  id: number;
}

export interface HiveState {
  puzzle: HivePuzzle;
  /** Every accepted word (answers and bonus words), in the order found. */
  found: string[];
  /** When each word was found (ms on the game clock). */
  foundAt: Record<string, number>;
  /** Words the coach revealed. */
  coached: string[];
  hints: number;
  /** Rejected entries (informational; they never cost points). */
  mistakes: number;
  input: string;
  /** The outer letters in their current (shuffled) order. */
  order: string;
  message: HiveMessage | null;
}

export type Action =
  | { type: "type"; letter: string }
  | { type: "delete" }
  | { type: "clear" }
  | { type: "shuffle"; order: string }
  | { type: "submit"; at: number }
  | { type: "hint-used" }
  | { type: "reveal"; word: string; at: number };

export function initialState(puzzle: HivePuzzle): HiveState {
  return { puzzle, found: [], foundAt: {}, coached: [], hints: 0, mistakes: 0, input: "", order: puzzle.outer, message: null };
}

function say(s: HiveState, text: string, tone: HiveMessage["tone"]): HiveMessage {
  return { text, tone, id: (s.message?.id ?? 0) + 1 };
}

function accept(s: HiveState, word: string, at: number, coached: boolean): HiveState {
  const check = checkWord(s.puzzle, s.found, word);
  if (!check.ok) return s;
  const found = [...s.found, word];
  let message: HiveMessage;
  if (check.kind === "bonus") message = say(s, "Bonus word: real, but not in today’s list. No points.", "bonus");
  else if (check.pangram) message = say(s, `Pangram! +${check.points}`, "pangram");
  else message = say(s, `${check.points >= 7 ? "Awesome!" : check.points >= 5 ? "Nice!" : "Good!"} +${check.points}`, "good");
  return {
    ...s,
    found,
    foundAt: { ...s.foundAt, [word]: at },
    coached: coached ? [...s.coached, word] : s.coached,
    input: "",
    message,
  };
}

export function reducer(s: HiveState, a: Action): HiveState {
  switch (a.type) {
    case "type": {
      const letter = a.letter.toLowerCase();
      if (!/^[a-z]$/.test(letter) || s.input.length >= MAX_INPUT) return s;
      return { ...s, input: s.input + letter };
    }
    case "delete":
      return { ...s, input: s.input.slice(0, -1) };
    case "clear":
      return { ...s, input: "" };
    case "shuffle":
      return { ...s, order: a.order };
    case "submit": {
      if (!s.input) return s;
      const check = checkWord(s.puzzle, s.found, s.input);
      if (!check.ok) {
        return { ...s, input: "", mistakes: s.mistakes + (check.reason === "found" ? 0 : 1), message: say(s, REJECT_MESSAGE[check.reason], "bad") };
      }
      return accept(s, s.input.toLowerCase(), a.at, false);
    }
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "reveal":
      return accept({ ...s, input: "" }, a.word, a.at, true);
  }
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function score(s: HiveState): number {
  return scoreOf(s.found, s.puzzle);
}

export function rank(s: HiveState): number {
  return rankIndex(score(s), s.puzzle.maxScore);
}

/** Answers found (bonus words don't count). */
export function answersFound(s: HiveState): string[] {
  const answers = new Set(s.puzzle.answers);
  return s.found.filter((w) => answers.has(w));
}

export function bonusFound(s: HiveState): string[] {
  const answers = new Set(s.puzzle.answers);
  return s.found.filter((w) => !answers.has(w));
}

export function allFound(s: HiveState): boolean {
  return rank(s) === TOP;
}

export function missed(s: HiveState): string[] {
  const have = new Set(s.found);
  return s.puzzle.answers.filter((w) => !have.has(w));
}

export function pangramsFound(s: HiveState): string[] {
  const letters = letterSet(s.puzzle);
  return answersFound(s).filter((w) => isPangram(w, letters));
}

/** Random order of the outer letters that differs from the current one. */
export function shuffled(order: string, random: () => number = Math.random): string {
  for (let tries = 0; tries < 10; tries++) {
    const a = order.split("");
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const next = a.join("");
    if (next !== order) return next;
  }
  return order.slice(1) + order[0];
}
