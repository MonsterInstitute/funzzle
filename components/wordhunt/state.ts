/**
 * Word Hunt play state: what the player has found and how much help they've
 * had. Pure, so it can be tested and saved to local storage as-is.
 */
import { isPath, spell, type WordHuntPuzzle } from "@/lib/games/wordhunt";

/** Bonus words that earn one hint. */
export const BONUS_PER_HINT = 3;
/** Free coach hints per puzzle (more after an opt-in rewarded ad). */
export const MAX_HINTS = 3;
export const MIN_GUESS = 4;

export interface Found {
  /** Index into puzzle.words. */
  word: number;
  /** ms on the clock. */
  at: number;
  /** Revealed by the coach's last rung. */
  revealed: boolean;
}

export interface PlayState {
  /** Theme words, in the order found. */
  found: Found[];
  /** Bonus words, lowercase, in the order found. */
  bonus: string[];
  /** Coach hints (the free three and rewarded ones). */
  hints: number;
  /** Hints paid for with bonus words. */
  earnedUsed: number;
  /** Traces that weren't a word. */
  misses: number;
}

export const initialState = (): PlayState => ({ found: [], bonus: [], hints: 0, earnedUsed: 0, misses: 0 });

export type Outcome =
  | { kind: "theme"; word: number; span: boolean }
  | { kind: "bonus"; word: string; earned: boolean }
  | { kind: "again"; word: string }
  | { kind: "elsewhere"; word: string }
  | { kind: "short"; word: string }
  | { kind: "unknown"; word: string };

export function foundSet(state: PlayState): Set<number> {
  return new Set(state.found.map((f) => f.word));
}

/** Cells covered by found theme words (they can't be traced again). */
export function claimedCells(puzzle: WordHuntPuzzle, state: PlayState): Map<number, number> {
  const m = new Map<number, number>();
  for (const f of state.found) for (const c of puzzle.words[f.word].path) m.set(c, f.word);
  return m;
}

export function earnedHints(state: PlayState): number {
  return Math.floor(state.bonus.length / BONUS_PER_HINT) - state.earnedUsed;
}

/** Progress toward the next earned hint, 0 … BONUS_PER_HINT - 1. */
export function meter(state: PlayState): number {
  return state.bonus.length % BONUS_PER_HINT;
}

export function isComplete(puzzle: WordHuntPuzzle, state: PlayState): boolean {
  return state.found.length === puzzle.words.length;
}

/** What a traced path means, without changing anything. */
export function judge(puzzle: WordHuntPuzzle, state: PlayState, path: number[]): Outcome {
  const word = isPath(path) ? spell(puzzle.grid, path) : "";
  const done = foundSet(state);
  const cells = [...path].sort((a, b) => a - b).join();
  const hit = puzzle.words.findIndex((w) => w.word === word && [...w.path].sort((a, b) => a - b).join() === cells);
  if (hit >= 0) return done.has(hit) ? { kind: "again", word } : { kind: "theme", word: hit, span: puzzle.words[hit].span };
  if (puzzle.words.some((w) => w.word === word)) return { kind: "elsewhere", word };
  if (word.length < MIN_GUESS) return { kind: "short", word };
  const lower = word.toLowerCase();
  if (state.bonus.includes(lower)) return { kind: "again", word };
  if (puzzle.bonus.includes(lower)) {
    return { kind: "bonus", word: lower, earned: (state.bonus.length + 1) % BONUS_PER_HINT === 0 };
  }
  return { kind: "unknown", word };
}

export type Action =
  | { type: "submit"; path: number[]; at: number }
  | { type: "hint"; source: "earned" | "coach" }
  | { type: "reveal"; word: number; at: number };

export function reducer(state: PlayState, action: Action, puzzle: WordHuntPuzzle): PlayState {
  switch (action.type) {
    case "submit": {
      const o = judge(puzzle, state, action.path);
      if (o.kind === "theme") return { ...state, found: [...state.found, { word: o.word, at: action.at, revealed: false }] };
      if (o.kind === "bonus") return { ...state, bonus: [...state.bonus, o.word] };
      if (o.kind === "unknown") return { ...state, misses: state.misses + 1 };
      return state;
    }
    case "hint":
      if (action.source === "earned") return earnedHints(state) > 0 ? { ...state, earnedUsed: state.earnedUsed + 1 } : state;
      return { ...state, hints: state.hints + 1 };
    case "reveal":
      if (foundSet(state).has(action.word) || !puzzle.words[action.word]) return state;
      return { ...state, found: [...state.found, { word: action.word, at: action.at, revealed: true }] };
  }
}

/**
 * Spoiler-free summary for the share card: one letter per theme word in the
 * order found. s = span word, t = theme word, r = revealed by the coach.
 */
export function shareMap(puzzle: WordHuntPuzzle, state: PlayState): string {
  return state.found.map((f) => (f.revealed ? "r" : puzzle.words[f.word].span ? "s" : "t")).join("");
}
