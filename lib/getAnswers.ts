import { createServiceSupabase } from "./supabase";

export type AnswerType = "nyt-mini" | "nyt-daily" | "wordle";

export interface CrosswordClue {
  number: number;
  clue: string;
  answer: string;
  explanation?: string;
}

export interface CrosswordAnswerData {
  across: CrosswordClue[];
  down: CrosswordClue[];
}

export interface WordleAnswerData {
  answer: string;
  hint_first_letter: string;
  hint_vowels: number;
}

export interface AnswerRow<T = unknown> {
  id: number;
  puzzle_id: number | null;
  publish_date: string;
  type: AnswerType;
  answer_data: T;
  summary: string | null;
  created_at: string;
}

/**
 * Fetch a single answer row by publish date (YYYY-MM-DD) and type.
 * Returns null when nothing has been published yet.
 */
export async function getAnswer<T = unknown>(
  publishDate: string,
  type: AnswerType
): Promise<AnswerRow<T> | null> {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("answers")
      .select("*")
      .eq("publish_date", publishDate)
      .eq("type", type)
      .maybeSingle();

    if (error) {
      console.error(`getAnswer(${publishDate}, ${type}) failed:`, error.message);
      return null;
    }
    return (data as AnswerRow<T> | null) ?? null;
  } catch (err) {
    // Missing env / network issue — degrade to a "coming soon" state
    // rather than crashing the page render or the static build.
    console.error(`getAnswer(${publishDate}, ${type}) threw:`, err);
    return null;
  }
}

/**
 * Fetch every answer published on a given date.
 */
export async function getAnswersByDate(
  publishDate: string
): Promise<AnswerRow[]> {
  try {
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("answers")
      .select("*")
      .eq("publish_date", publishDate)
      .order("type", { ascending: true });

    if (error) {
      console.error(`getAnswersByDate(${publishDate}) failed:`, error.message);
      return [];
    }
    return (data as AnswerRow[]) ?? [];
  } catch (err) {
    console.error(`getAnswersByDate(${publishDate}) threw:`, err);
    return [];
  }
}
