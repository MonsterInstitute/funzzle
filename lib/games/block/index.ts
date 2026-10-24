/**
 * Block Puzzle (8×8, three pieces at a time). The daily is a fixed sequence of
 * DAILY_PIECES pieces from the seed "block-puzzle:<date>", stored with the
 * daily row so it never changes once people are playing it.
 */
import { DAILY_PIECES, sequence } from "./engine";

export * from "./engine";
export { bestPlacement, boardValue, autoplay, type Hint, type HintReason } from "./coach";

export interface DailyBlock {
  date: string;
  seed: string;
  /** The day's piece ids, in order (lib/games/block/engine PIECES). */
  pieces: string[];
}

export function dailyBlock(date: string): DailyBlock {
  const seed = `block-puzzle:${date}`;
  return { date, seed, pieces: sequence(seed, DAILY_PIECES) };
}
