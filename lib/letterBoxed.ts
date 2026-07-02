import { parseISODate } from "./dates";
import {
  LETTER_BOXED_PUZZLES,
  LETTER_BOXED_DICT,
  type LetterBoxedPuzzle,
} from "./content/letterBoxed";

export type { LetterBoxedPuzzle };
export { LETTER_BOXED_PUZZLES };

const DICT = new Set(LETTER_BOXED_DICT);

export function puzzleForDate(iso: string): LetterBoxedPuzzle {
  const dow = parseISODate(iso).getUTCDay();
  return LETTER_BOXED_PUZZLES[dow % LETTER_BOXED_PUZZLES.length];
}

export function allLetters(puzzle: LetterBoxedPuzzle): string[] {
  return puzzle.sides.join("").split("");
}

function sideOf(letter: string, puzzle: LetterBoxedPuzzle): number {
  return puzzle.sides.findIndex((s) => s.includes(letter));
}

/** Validate a word against the puzzle and the previous word. null = valid. */
export function validateWord(
  word: string,
  puzzle: LetterBoxedPuzzle,
  prevWord: string | null
): string | null {
  const w = word.toUpperCase();
  if (w.length < 3) return "Words must be 3+ letters";
  const set = new Set(allLetters(puzzle));
  for (const ch of w) if (!set.has(ch)) return "Uses a letter not in the puzzle";
  for (let i = 0; i < w.length - 1; i++) {
    if (sideOf(w[i], puzzle) === sideOf(w[i + 1], puzzle)) {
      return "Two letters in a row can't be on the same side";
    }
  }
  if (prevWord && w[0] !== prevWord[prevWord.length - 1]) {
    return "Must start with the previous word's last letter";
  }
  if (!DICT.has(w)) return "Not in the word list";
  return null;
}

/** Letters covered by the chain of played words. */
export function usedLetters(words: string[]): Set<string> {
  const s = new Set<string>();
  for (const w of words) for (const ch of w) s.add(ch);
  return s;
}

export function isSolved(words: string[], puzzle: LetterBoxedPuzzle): boolean {
  const used = usedLetters(words);
  return allLetters(puzzle).every((l) => used.has(l));
}
