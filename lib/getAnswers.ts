import { createServiceSupabase } from "./supabase";
import { DAILY_CONTENT } from "./content/dailyAnswers";
import { getLocalWordle } from "./content/wordleAnswers";

export type AnswerType = "nyt-mini" | "nyt-daily" | "wordle" | "connections";

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

export interface ConnectionsGroup {
  title: string;
  color: "yellow" | "green" | "blue" | "purple" | null;
  level: number;
  words: string[];
  note?: string;
}

export interface ConnectionsAnswerData {
  groups: ConnectionsGroup[];
  editor?: string | null;
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
 * Build an answer row from bundled local content, used as a fallback when
 * Supabase has no row (or is unreachable). This keeps every seeded answer page
 * rendering — and building statically — regardless of DB state.
 */
export function localAnswer(
  publishDate: string,
  type: AnswerType
): AnswerRow | null {
  if (type === "wordle") {
    const wordle = getLocalWordle(publishDate);
    if (wordle) {
      return {
        id: -1,
        puzzle_id: null,
        publish_date: publishDate,
        type,
        answer_data: wordle.answer_data,
        summary: wordle.summary,
        created_at: "",
      };
    }
  }

  const day = DAILY_CONTENT.find((d) => d.date === publishDate);
  if (!day) return null;

  if (type === "nyt-mini") {
    return {
      id: -1,
      puzzle_id: null,
      publish_date: publishDate,
      type,
      answer_data: day.mini,
      summary: day.miniSummary,
      created_at: "",
    };
  }
  if (type === "wordle") {
    return {
      id: -1,
      puzzle_id: null,
      publish_date: publishDate,
      type,
      answer_data: day.wordle,
      summary: day.wordleSummary,
      created_at: "",
    };
  }
  // No local nyt-daily content.
  return null;
}

/**
 * Fetch a single answer row by publish date (YYYY-MM-DD) and type.
 * Prefers Supabase; falls back to bundled local content.
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
      return (localAnswer(publishDate, type) as AnswerRow<T> | null) ?? null;
    }
    return (
      (data as AnswerRow<T> | null) ??
      (localAnswer(publishDate, type) as AnswerRow<T> | null) ??
      null
    );
  } catch (err) {
    // Missing env / network issue — degrade to local content, then to a
    // "coming soon" state, rather than crashing the render or static build.
    console.error(`getAnswer(${publishDate}, ${type}) threw:`, err);
    return (localAnswer(publishDate, type) as AnswerRow<T> | null) ?? null;
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
