/**
 * Letter Box play state: a pure reducer over the puzzle (it ships its own
 * playable word list), so the browser never needs the lexicon.
 *
 * `current` is the word being spelled. After a word is accepted, `current`
 * starts as that word's last letter (each word chains from the previous one).
 * Deleting that carried letter takes the previous word back for editing.
 */
import { checkWord, FULL, REJECT_MESSAGE, sideMap, usedMask, type LetterBoxPuzzle } from "@/lib/games/letterbox";

export const MAX_HINTS = 3;
export const MAX_WORD = 20;

export interface BoxMessage {
  text: string;
  tone: "good" | "bad";
  id: number;
}

export interface BoxState {
  puzzle: LetterBoxPuzzle;
  /** Accepted words, in order. */
  words: string[];
  current: string;
  /** When each accepted word was played (ms on the game clock), by index. */
  playedAt: number[];
  /** Words the coach played. */
  coached: string[];
  hints: number;
  /** Rejected words. */
  mistakes: number;
  /** Times the player cleared the board. */
  restarts: number;
  message: BoxMessage | null;
}

export type Action =
  | { type: "tap"; letter: string }
  | { type: "delete" }
  | { type: "submit"; at: number }
  | { type: "restart" }
  | { type: "hint-used" }
  | { type: "play"; word: string; restart: boolean; at: number };

export function initialState(puzzle: LetterBoxPuzzle): BoxState {
  return { puzzle, words: [], current: "", playedAt: [], coached: [], hints: 0, mistakes: 0, restarts: 0, message: null };
}

const say = (s: BoxState, text: string, tone: BoxMessage["tone"]): BoxMessage => ({ text, tone, id: (s.message?.id ?? 0) + 1 });

/** Can `letter` be tapped next? (In the box, and not on the same side as the previous letter.) */
export function canTap(s: BoxState, letter: string): boolean {
  const sides = sideMap(s.puzzle.sides);
  const side = sides.get(letter);
  if (side === undefined || s.current.length >= MAX_WORD) return false;
  const prev = s.current[s.current.length - 1];
  return prev === undefined || sides.get(prev) !== side;
}

function accept(s: BoxState, word: string, at: number, coached: boolean): BoxState {
  const words = [...s.words, word];
  const solved = usedMask(words, s.puzzle.sides) === FULL;
  const left = 12 - popcount(usedMask(words, s.puzzle.sides));
  return {
    ...s,
    words,
    current: solved ? "" : word[word.length - 1],
    playedAt: [...s.playedAt, at],
    coached: coached ? [...s.coached, word] : s.coached,
    message: say(s, solved ? "Every letter used!" : `${word.toUpperCase()} · ${left} letter${left === 1 ? "" : "s"} to go`, "good"),
  };
}

function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export function reducer(s: BoxState, a: Action): BoxState {
  if (isSolved(s) && a.type !== "hint-used") return s;
  switch (a.type) {
    case "tap": {
      const letter = a.letter.toLowerCase();
      if (!canTap(s, letter)) return s;
      return { ...s, current: s.current + letter };
    }
    case "delete": {
      if (s.current.length > 1 || (s.current.length === 1 && !s.words.length)) return { ...s, current: s.current.slice(0, -1) };
      if (!s.words.length) return s;
      // The carried letter: take the previous word back.
      return { ...s, words: s.words.slice(0, -1), playedAt: s.playedAt.slice(0, -1), current: s.words[s.words.length - 1] };
    }
    case "submit": {
      if (!s.current) return s;
      const check = checkWord(s.puzzle, s.words, s.current);
      if (!check.ok) return { ...s, mistakes: s.mistakes + 1, message: say(s, REJECT_MESSAGE[check.reason], "bad") };
      return accept(s, s.current, a.at, false);
    }
    case "restart":
      if (!s.words.length && !s.current) return s;
      return { ...s, words: [], current: "", playedAt: [], restarts: s.restarts + 1, message: null };
    case "hint-used":
      return { ...s, hints: s.hints + 1 };
    case "play": {
      const base = a.restart ? { ...s, words: [], playedAt: [], current: "" } : s;
      if (!checkWord(base.puzzle, base.words, a.word).ok) return s;
      return accept(base, a.word, a.at, true);
    }
  }
}

export function isSolved(s: BoxState): boolean {
  return s.words.length > 0 && usedMask(s.words, s.puzzle.sides) === FULL;
}

/** Box positions (index into sides.join("")) of every letter played, in order, as one chain. */
export function pathPositions(s: Pick<BoxState, "puzzle" | "words">, current = ""): number[] {
  const all = s.puzzle.sides.join("");
  const chain = s.words.map((w, i) => (i ? w.slice(1) : w)).join("");
  const tail = s.words.length ? current.slice(1) : current;
  return (chain + tail).split("").map((c) => all.indexOf(c));
}

/** Positions used by accepted words plus the word in progress. */
export function usedPositions(s: BoxState): Set<number> {
  return new Set(pathPositions(s, s.current));
}
