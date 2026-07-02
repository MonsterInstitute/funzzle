import { parseISODate } from "./dates";

/** Answer pool — 50 common five-letter words. */
export const WORD_POOL: string[] = [
  "CRANE", "SLATE", "AUDIO", "ROAST", "PLANT",
  "GRAPE", "MOUNT", "LIGHT", "BRAVE", "CHESS",
  "DRINK", "EAGLE", "FLAME", "GHOST", "HEART",
  "IVORY", "JOKER", "KNEEL", "LEMON", "MANGO",
  "NIGHT", "OCEAN", "PIANO", "QUILT", "RIVER",
  "STONE", "TIGER", "URBAN", "VOICE", "WHALE",
  "YACHT", "ZEBRA", "APPLE", "BERRY", "CLOUD",
  "DANCE", "EARTH", "FROST", "GLORY", "HONEY",
  "INDEX", "JELLY", "KOALA", "LUCKY", "MEDAL",
  "NORTH", "OLIVE", "PEARL", "QUEEN", "ROBOT",
];

/**
 * Deterministically pick the answer for a given calendar day.
 * The same date always yields the same word for every visitor.
 */
export function wordForDate(iso: string): string {
  // Days since the Unix epoch → stable index into the pool.
  const days = Math.floor(parseISODate(iso).getTime() / 86_400_000);
  const index = ((days % WORD_POOL.length) + WORD_POOL.length) % WORD_POOL.length;
  return WORD_POOL[index];
}
