import { createServiceSupabase } from "./supabase";

export interface PuzzleRow {
  id: number;
  slug: string;
  type: string;
  publish_date: string;
  title: string | null;
  size: number | null;
  grid: unknown;
  clues: unknown;
  created_at: string;
}

/**
 * Fetch a single puzzle by its slug. Returns null if not found.
 */
export async function getPuzzle(slug: string): Promise<PuzzleRow | null> {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("puzzles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`getPuzzle(${slug}) failed:`, error.message);
      return null;
    }
    return (data as PuzzleRow | null) ?? null;
  } catch (err) {
    console.error(`getPuzzle(${slug}) threw:`, err);
    return null;
  }
}

/**
 * Fetch a puzzle by publish date (YYYY-MM-DD) and type.
 */
export async function getPuzzleByDate(
  publishDate: string,
  type: string
): Promise<PuzzleRow | null> {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("puzzles")
      .select("*")
      .eq("publish_date", publishDate)
      .eq("type", type)
      .maybeSingle();

    if (error) {
      console.error(`getPuzzleByDate(${publishDate}, ${type}) failed:`, error.message);
      return null;
    }
    return (data as PuzzleRow | null) ?? null;
  } catch (err) {
    console.error(`getPuzzleByDate(${publishDate}, ${type}) threw:`, err);
    return null;
  }
}
