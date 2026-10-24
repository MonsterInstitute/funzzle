import { first, parseJson } from "./db";
import { puzzleRowToMini, type MiniPuzzle } from "./miniCrossword";

/**
 * Fetch and map the mini crossword published for a given date into a playable
 * MiniPuzzle. Returns null when nothing is published (or the row is unusable),
 * so the caller can fall back to the built-in sample. A database failure
 * throws, so an outage is never cached as the sample puzzle.
 */
export async function getMiniPuzzle(publishDate: string): Promise<MiniPuzzle | null> {
  const row = await first<{ title: string | null; grid: string | null; clues: string | null }>(
    "SELECT title, grid, clues FROM puzzles WHERE publish_date = ? AND type IN ('mini', 'nyt-mini') ORDER BY created_at DESC LIMIT 1",
    publishDate
  );
  if (!row) return null;
  return puzzleRowToMini({ title: row.title, grid: parseJson(row.grid), clues: parseJson(row.clues) });
}
