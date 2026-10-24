/**
 * Classic and Quad puzzles: five-letter answers from ANSWERS5 (common words,
 * no plain inflections, no blocked words), guesses checked against VALID5.
 * Browser-safe: only lib/games/words/words5 is imported.
 */
import { createRng } from "@/lib/games/kit/rng";
import { ANSWERS5, VALID5 } from "@/lib/games/words/words5";
import { dayIndex, scheduledIndex } from "./schedule";

export const WORD_LENGTH = 5;
export const CLASSIC_ROWS = 6;
export const QUAD_ROWS = 9;
export const QUAD_BOARDS = 4;
/** A daily answer never comes back within this many days. */
export const ANSWER_GAP = 366;

export function isGuessWord(word: string): boolean {
  return word.length === WORD_LENGTH && VALID5.has(word);
}

/** Today's classic answer (lowercase), the same for everyone. */
export function classicAnswer(date: string): string {
  return ANSWERS5.at(scheduledIndex("word:classic", ANSWERS5.size, dayIndex(date), ANSWER_GAP));
}

/** Four distinct answers for a Quad puzzle from a seed, none of them `avoid`. */
export function quadAnswersFromSeed(seed: string, avoid: readonly string[] = []): string[] {
  const rng = createRng(seed);
  const out: string[] = [];
  while (out.length < QUAD_BOARDS) {
    const w = ANSWERS5.at(rng.int(ANSWERS5.size));
    if (!out.includes(w) && !avoid.includes(w)) out.push(w);
  }
  return out;
}

/** Today's four Quad answers; never today's classic answer. */
export function quadAnswers(date: string): string[] {
  return quadAnswersFromSeed(`word:quad:${date}`, [classicAnswer(date)]);
}

export function practiceAnswer(seed: string): string {
  return ANSWERS5.at(createRng(seed).int(ANSWERS5.size));
}
