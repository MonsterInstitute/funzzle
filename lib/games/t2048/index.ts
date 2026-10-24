/**
 * 2048: slide-and-merge on a 4×4 board, with seeded spawns (engine.ts) so the
 * daily game deals the same tiles to everyone, and an expectimax coach.
 */
export * from "./engine";
export { bestMove, coachPlay, WHY, type Hint, type Reason } from "./coach";
import { newGame } from "./engine";

/**
 * Today's 2048: the seed decides the two starting tiles and every spawn
 * (spawn after move n = f(seed, n), see engine.ts). `start` is the starting
 * board as exponents, stored with the row so a stored daily documents itself.
 */
export interface Daily2048 {
  date: string;
  seed: string;
  start: number[];
}

export function daily2048(date: string): Daily2048 {
  const seed = `2048:${date}`;
  const s = newGame(seed);
  const start = new Array<number>(16).fill(0);
  for (const t of s.tiles) start[t.cell] = t.v;
  return { date, seed, start };
}
