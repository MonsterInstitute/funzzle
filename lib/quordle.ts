import { WORD_POOL } from "./wordleWords";
import { seedFromDate } from "./connections";

/** Answer pool for Quordle — the shared Wordle pool plus extras for variety. */
export const QUORDLE_POOL: string[] = Array.from(
  new Set([
    ...WORD_POOL,
    "ABOUT", "BEACH", "CHAIR", "DREAM", "EARTH", "FROND", "GLOVE", "HOUSE",
    "INPUT", "JOLLY", "KOALA", "LATCH", "MIGHT", "NORTH", "OLIVE", "PRIZE",
    "QUACK", "ROUND", "SHINE", "TRUCK", "UNITE", "VIVID", "WORLD", "YOUTH",
    "ZONED", "BLINK", "CLOWN", "DAISY", "EAGER", "FAITH", "GRAND", "HAPPY",
    "IVORY", "JUMBO", "KNIFE", "LEMON", "MIRTH", "NOBLE", "OCEAN", "PLUMB",
  ])
);

/** Pick 4 distinct words starting from an index derived from a seed. */
function pickFour(seed: number): string[] {
  const n = QUORDLE_POOL.length;
  const picks: string[] = [];
  let s = seed >>> 0 || 1;
  while (picks.length < 4) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const w = QUORDLE_POOL[s % n];
    if (!picks.includes(w)) picks.push(w);
  }
  return picks;
}

export function wordsForDate(iso: string): string[] {
  return pickFour(seedFromDate(iso));
}

export type LetterState = "correct" | "present" | "absent" | "empty";

/** Wordle-style scoring with duplicate handling. */
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const res: LetterState[] = Array(5).fill("absent");
  const counts: Record<string, number> = {};
  for (const c of answer) counts[c] = (counts[c] ?? 0) + 1;
  for (let i = 0; i < 5; i++)
    if (guess[i] === answer[i]) {
      res[i] = "correct";
      counts[guess[i]]--;
    }
  for (let i = 0; i < 5; i++) {
    if (res[i] === "correct") continue;
    if (counts[guess[i]] > 0) {
      res[i] = "present";
      counts[guess[i]]--;
    }
  }
  return res;
}
