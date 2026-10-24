/**
 * Five-letter words for Funzzle Word (and its 4-board Quad mode). Safe to
 * import in the browser: ~29 KB gzip for answers + every accepted guess.
 *
 * All words are lowercase; lookups are case-insensitive.
 */
import { COMMON, EXTRA } from "./data/len05";
import { ANSWERS, GUESS_EXTRA } from "./data/words5";
import { PackedWords, UnionWords, type WordList } from "./packed";
import type { Rng } from "../kit/rng";

/** Answer pool (~2k common words, no plain plurals / -ed / -ing forms), sorted. */
export const ANSWERS5 = new PackedWords(ANSWERS, 5);

/** Every accepted guess (~8.6k): SCOWL <= 50 plus ENABLE. Includes every answer. */
export const VALID5: WordList = new UnionWords([
  new PackedWords(COMMON, 5),
  new PackedWords(EXTRA, 5),
  new PackedWords(GUESS_EXTRA, 5),
]);

export function isValid5(word: string): boolean {
  return VALID5.has(word);
}

export function isAnswer5(word: string): boolean {
  return ANSWERS5.has(word);
}

/** `count` distinct answers picked with a seeded RNG (Quad mode uses 4). */
export function pickAnswers5(rng: Rng, count = 1): string[] {
  const n = ANSWERS5.size;
  if (count > n) throw new RangeError(`only ${n} answers`);
  const picked = new Set<number>();
  while (picked.size < count) picked.add(rng.int(n));
  return [...picked].map((i) => ANSWERS5.at(i));
}
