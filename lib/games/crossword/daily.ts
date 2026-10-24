/**
 * Daily crossword pickers that run anywhere (no lexicon): the fallback bank
 * puzzle for a date and practice puzzles. The stored row written by the cron
 * (lib/cron/content/crossword.ts: code-filled grid + DeepSeek clues) always
 * wins; the bank is only for dates without one, so the page never shows an
 * empty grid. Bank puzzles are 11×11 whatever the weekday.
 */
import { createRng } from "../kit/rng";
import { BANK } from "./bank";
import type { CrosswordPuzzle } from "./puzzle";

const DAY_MS = 86_400_000;

/** Bank index for a date: a seeded shuffle per run through the bank, so neighbors differ. */
export function bankIndexFor(date: string, n = BANK.length): number {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  const cycle = Math.floor(day / n);
  const order = createRng(`crossword-bank:${cycle}`).shuffle(Array.from({ length: n }, (_, i) => i));
  return order[day - cycle * n];
}

export function fallbackDailyCrossword(date: string): CrosswordPuzzle {
  return BANK[bankIndexFor(date)];
}

/** Practice puzzle `n` of the bank ("crossword-practice:3"). */
export function practiceCrossword(index: number): CrosswordPuzzle {
  return BANK[((index % BANK.length) + BANK.length) % BANK.length];
}

export const PRACTICE_COUNT = () => BANK.length;
