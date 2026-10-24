/** Shared daily_puzzles helpers for the LLM content jobs (word search, crossword). */
import { all, batch } from "@/lib/db";

/** Dates (of `dates`) that already have a row for `game`. */
export async function storedDates(game: string, dates: string[]): Promise<Set<string>> {
  if (!dates.length) return new Set();
  const rows = await all<{ puzzle_date: string }>(
    `SELECT puzzle_date FROM daily_puzzles WHERE game = ? AND variant = '' AND puzzle_date IN (${dates.map(() => "?").join(", ")})`,
    game,
    ...dates
  );
  return new Set(rows.map((r) => r.puzzle_date));
}

/** Stored rows of `game` from the `days` before `date` (newest first), parsed. */
export async function recentRows<T>(game: string, date: string, days: number): Promise<T[]> {
  const from = new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await all<{ data: string }>(
    "SELECT data FROM daily_puzzles WHERE game = ? AND variant = '' AND puzzle_date >= ? AND puzzle_date < ? ORDER BY puzzle_date DESC",
    game,
    from,
    date
  );
  return rows.map((r) => JSON.parse(r.data) as T);
}

/** Insert rows; an existing row for the same date always wins (ON CONFLICT DO NOTHING). */
export async function storeRows(game: string, rows: { date: string; data: unknown }[]): Promise<void> {
  if (!rows.length) return;
  await batch(
    rows.map((r) => [
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, '', ?) ON CONFLICT DO NOTHING",
      game,
      r.date,
      JSON.stringify(r.data),
    ])
  );
}
