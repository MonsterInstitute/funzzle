/**
 * Server-side Word Hunt: theme → playable puzzle (grid + bonus words), the
 * fallback bank by date, and practice puzzles. GENERATOR-SIDE ONLY: imports
 * the full lexicon through bonus.ts.
 */
import { hashSeed } from "@/lib/games/kit/rng";
import { BANK, BANK_BY_ID } from "./bank";
import { findBonusWords } from "./bonus";
import { generateWordHunt } from "./generate";
import type { WordHuntPuzzle, WordHuntTheme } from "./types";

export function buildPuzzle(theme: WordHuntTheme, seed: string): WordHuntPuzzle {
  const g = generateWordHunt(theme, seed);
  return {
    id: theme.id,
    title: theme.title,
    grid: g.grid,
    words: g.words,
    bonus: findBonusWords(g.grid, g.words.map((w) => w.word)),
  };
}

/** Bank puzzles never change between calls (same theme, same seed). */
const cache = new Map<string, WordHuntPuzzle>();

export function bankPuzzle(id: string): WordHuntPuzzle | null {
  const theme = BANK_BY_ID[id];
  if (!theme) return null;
  let p = cache.get(id);
  if (!p) {
    p = buildPuzzle(theme, `word-hunt:bank:${id}`);
    cache.set(id, p);
  }
  return p;
}

const DAY_MS = 86_400_000;
/** A fixed shuffle of the bank, so consecutive days never repeat a theme until the bank runs out. */
const ORDER = BANK.map((t) => t.id).sort((a, b) => hashSeed(`order:${a}`) - hashSeed(`order:${b}`));

/** The bank theme for a date (the page's fallback when no AI theme is stored). */
export function bankIdForDate(date: string): string {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  return ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length];
}
