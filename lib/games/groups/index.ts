/**
 * Groups engine: puzzle shape (./puzzle), the fallback bank (./bank), the
 * coach (./coach). Client-safe; the lexicon checks are in ./validate.
 */
import { createRng } from "@/lib/games/kit/rng";
import { BANK, BANK_BY_ID } from "./bank";
import type { GroupsPuzzle } from "./puzzle";

export * from "./puzzle";
export * from "./coach";
export { BANK, BANK_BY_ID };

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(2026, 0, 1);
/** The bank in a fixed shuffled order; consecutive days walk through it. */
const ORDER = createRng("groups-bank-order").shuffle(BANK.map((p) => p.id));

/** Practice skips the bank puzzles the daily fallback used this many days back. */
export const RECENT_DAYS = 7;

const dayNumber = (date: string) => Math.floor((Date.parse(`${date}T00:00:00Z`) - EPOCH) / DAY_MS);

/** The fallback daily for a date (when no generated row is stored): a pure function of the date. */
export function bankPuzzleFor(date: string): GroupsPuzzle {
  const n = ORDER.length;
  const i = ((dayNumber(date) % n) + n) % n;
  return BANK_BY_ID[ORDER[i]];
}

/**
 * A practice puzzle from the bank: not one the daily fallback used in the
 * last RECENT_DAYS days (or tomorrow's), and not one already played on this
 * device while unplayed ones remain.
 */
export function practicePick(today: string, played: string[], random: () => number): GroupsPuzzle {
  const recent = new Set<string>();
  for (let d = -1; d <= RECENT_DAYS; d++) recent.add(bankPuzzleFor(new Date(Date.parse(`${today}T00:00:00Z`) - d * DAY_MS).toISOString().slice(0, 10)).id);
  const done = new Set(played);
  const fresh = BANK.filter((p) => !recent.has(p.id) && !done.has(p.id));
  const pool = fresh.length ? fresh : BANK.filter((p) => !recent.has(p.id));
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
