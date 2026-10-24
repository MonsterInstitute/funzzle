/**
 * Deterministic daily schedules. Day d (counted from EPOCH) walks through a
 * seeded permutation of the pool; each pass of `size` days is one cycle with
 * its own permutation. At a cycle boundary the first `gap` days of the new
 * cycle are swapped so they never reuse anything from the last `gap` days of
 * the previous one, so no item comes back within `gap` days, ever.
 */
import { createRng } from "@/lib/games/kit/rng";

export const EPOCH = "2026-01-01";
const DAY_MS = 86_400_000;

export function dayIndex(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / DAY_MS);
}

function cycle(salt: string, k: number, size: number): number[] {
  const perm = Array.from({ length: size }, (_, i) => i);
  return createRng(`${salt}:cycle:${k}`).shuffle(perm);
}

/** Largest gap a pool of `size` supports (the swap needs size >= 3 * gap). */
export const maxGap = (size: number) => Math.floor(size / 3);

/** Index into a pool of `size` items for day `day`; no repeat within `gap` days. */
export function scheduledIndex(salt: string, size: number, day: number, gap: number): number {
  if (gap > maxGap(size)) throw new RangeError(`gap ${gap} too large for ${size} items`);
  const k = Math.floor(day / size);
  const i = day - k * size;
  const perm = cycle(salt, k, size);
  // Swap the head's repeats with middle items. The tail is never touched, so
  // the previous cycle's tail is just its raw permutation.
  const recent = new Set(cycle(salt, k - 1, size).slice(size - gap));
  let j = gap;
  for (let a = 0; a < gap; a++) {
    if (!recent.has(perm[a])) continue;
    while (recent.has(perm[j])) j++;
    [perm[a], perm[j]] = [perm[j], perm[a]];
    j++;
  }
  return perm[i];
}
