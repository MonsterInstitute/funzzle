/**
 * Seeded randomness shared by every game generator. A daily puzzle is a pure
 * function of its seed (e.g. "sudoku:2026-10-24"), so the server, the browser
 * fallback and the generation script all produce the same puzzle.
 */

/** 32-bit FNV-1a hash of a string, used to turn a text seed into a number. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** Fisher-Yates shuffle in place; returns the array. */
  shuffle<T>(items: T[]): T[];
}

/** mulberry32: small, fast, good enough for puzzle generation. */
export function createRng(seed: string | number): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const shuffle = <T,>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  return { next, int, shuffle };
}
