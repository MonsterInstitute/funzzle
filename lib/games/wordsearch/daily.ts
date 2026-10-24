/**
 * Daily and practice grids. The daily grid is 12×12; the stored row (a
 * DeepSeek theme, lib/cron/content/wordsearch.ts) wins, otherwise the
 * fallback bank picks a theme by date: each run through the bank is a seeded
 * shuffle, so consecutive days never repeat a theme and the order changes
 * every cycle.
 */
import { createRng, hashSeed } from "../kit/rng";
import { generateWordSearch, type Theme, type WordSearchPuzzle } from "./generate";
import { THEMES } from "./themes";

export const DAILY_SIZE = 12;

const DAY_MS = 86_400_000;

export function bankThemeFor(date: string, bank: Theme[] = THEMES): Theme {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  const cycle = Math.floor(day / bank.length);
  const order = createRng(`word-search-bank:${cycle}`).shuffle(bank.map((_, i) => i));
  return bank[order[day - cycle * bank.length]];
}

/** The fallback daily grid for a date (no stored row). */
export function fallbackDailyWordSearch(date: string): WordSearchPuzzle {
  return generateWordSearch(`word-search:${date}`, bankThemeFor(date), DAILY_SIZE);
}

/** A practice grid: the seed picks the theme and the layout, so a challenge link replays it. */
export function practiceWordSearch(seed: string, size: number): WordSearchPuzzle {
  return generateWordSearch(seed, THEMES[hashSeed(`theme:${seed}`) % THEMES.length], size);
}
