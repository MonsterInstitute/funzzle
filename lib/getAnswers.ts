import { createServiceSupabase, hasServiceSupabase } from "./supabase";
import { DAILY_CONTENT } from "./content/dailyAnswers";
import { getLocalWordle } from "./content/wordleAnswers";
import { todayISO } from "./dates";

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
 * The answers table couldn't be read (Supabase error, timeout, network) —
 * distinct from a date that genuinely has no row yet. It is thrown, not
 * turned into "coming soon": a render that throws is never cached, so ISR
 * keeps serving the last good page (or returns an uncached 500 on a first
 * render) and retries on a later request, instead of freezing a page that
 * has data on its placeholder until the next revalidation.
 */
export class AnswersUnavailableError extends Error {
  constructor(what: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String((cause as { message?: string })?.message ?? cause);
    super(`${what}: answers table unavailable — ${detail}`, { cause });
    this.name = "AnswersUnavailableError";
  }
}

/**
 * Fetch a single answer row by publish date (YYYY-MM-DD) and type.
 * Supabase first; a date with no row falls back to bundled local content,
 * then to null ("coming soon"). A database failure throws
 * AnswersUnavailableError instead — see there. Deployments without Supabase
 * configured (e.g. previews) serve local content only.
 *
 * A date's answers are stored ahead of time (the answers cron fetches
 * tomorrow's before midnight UTC) but stay hidden until that UTC day begins;
 * the midnight revalidation then publishes them.
 */
export async function getAnswer<T = unknown>(
  publishDate: string,
  type: AnswerType
): Promise<AnswerRow<T> | null> {
  if (publishDate > todayISO()) return null;
  const local = () => (localAnswer(publishDate, type) as AnswerRow<T> | null) ?? null;
  if (!hasServiceSupabase) return local();

  let result;
  try {
    // Newest row wins, so a transient duplicate (two writers racing) can't
    // turn the page into an error.
    result = await createServiceSupabase()
      .from("answers")
      .select("*")
      .eq("publish_date", publishDate)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  } catch (err) {
    throw new AnswersUnavailableError(`getAnswer(${publishDate}, ${type})`, err);
  }
  if (result.error) throw new AnswersUnavailableError(`getAnswer(${publishDate}, ${type})`, result.error);
  return (result.data as AnswerRow<T> | null) ?? local();
}

/**
 * Fetch every answer published on a given date. Throws
 * AnswersUnavailableError on a database failure (see getAnswer).
 */
export async function getAnswersByDate(
  publishDate: string
): Promise<AnswerRow[]> {
  if (publishDate > todayISO() || !hasServiceSupabase) return [];
  let result;
  try {
    result = await createServiceSupabase()
      .from("answers")
      .select("*")
      .eq("publish_date", publishDate)
      .order("type", { ascending: true });
  } catch (err) {
    throw new AnswersUnavailableError(`getAnswersByDate(${publishDate})`, err);
  }
  if (result.error) throw new AnswersUnavailableError(`getAnswersByDate(${publishDate})`, result.error);
  return (result.data as AnswerRow[]) ?? [];
}
