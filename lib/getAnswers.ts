import { all, first, parseJson } from "./db";
import { DAILY_CONTENT } from "./content/dailyAnswers";
import { getLocalWordle } from "./content/wordleAnswers";
import { todayISO } from "./dates";

export type AnswerType =
  | "nyt-mini"
  | "nyt-daily"
  | "wordle"
  | "connections"
  | "strands"
  | "letter-boxed"
  | "quordle"
  | "worldle"
  | "nerdle";

/** NYT Strands (nytimes.com/svc/strands/v2). */
export interface StrandsAnswerData {
  /** NYT's theme clue, e.g. "Re-fresh-ing". */
  clue: string;
  spangram: string;
  words: string[];
  puzzle_id: number | null;
  editor: string | null;
  constructors: string | null;
}

/** NYT Letter Boxed: the box and NYT's own solution. */
export interface LetterBoxedAnswerData {
  /** Four sides of three letters, in NYT's order. */
  sides: string[];
  solution: string[];
  par: number | null;
  puzzle_id: number | null;
  editor: string | null;
}

/** Quordle (Merriam-Webster): the four words, in board order. */
export interface QuordleAnswerData {
  number: number;
  words: string[];
}

/** Worldle (teuteuf.fr): the day's country or territory. */
export interface WorldleAnswerData {
  country_code: string;
  country: string;
  lat: number;
  lng: number;
}

/** Nerdle (classic, nerdlegame.com). */
export interface NerdleAnswerData {
  equation: string;
  number: number | null;
}

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
 * the database has no row. This keeps every seeded answer page
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
 * The answers table couldn't be read (D1 error, timeout) — distinct from a
 * date that genuinely has no row yet. It is thrown, not turned into "coming
 * soon": a render that throws is never cached, so ISR keeps serving the last
 * good page (or returns an uncached 500 on a first render) and retries on a
 * later request, instead of freezing a page that has data on its placeholder
 * until the next revalidation.
 */
export class AnswersUnavailableError extends Error {
  constructor(what: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`${what}: answers table unavailable — ${detail}`, { cause });
    this.name = "AnswersUnavailableError";
  }
}

type StoredAnswer = Omit<AnswerRow, "answer_data"> & { answer_data: string };
const toRow = <T>(r: StoredAnswer): AnswerRow<T> => ({ ...r, answer_data: parseJson<T>(r.answer_data) as T });

/**
 * Fetch a single answer row by publish date (YYYY-MM-DD) and type.
 * D1 first; a date with no row falls back to bundled local content, then to
 * null ("coming soon"). A database failure throws AnswersUnavailableError
 * instead — see there.
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
  let row: StoredAnswer | null;
  try {
    row = await first<StoredAnswer>(
      "SELECT id, puzzle_id, publish_date, type, answer_data, summary, created_at FROM answers WHERE publish_date = ? AND type = ?",
      publishDate,
      type
    );
  } catch (err) {
    throw new AnswersUnavailableError(`getAnswer(${publishDate}, ${type})`, err);
  }
  return row ? toRow<T>(row) : ((localAnswer(publishDate, type) as AnswerRow<T> | null) ?? null);
}

/**
 * Fetch every answer published on a given date. Throws
 * AnswersUnavailableError on a database failure (see getAnswer).
 */
export async function getAnswersByDate(
  publishDate: string
): Promise<AnswerRow[]> {
  if (publishDate > todayISO()) return [];
  try {
    const rows = await all<StoredAnswer>(
      "SELECT id, puzzle_id, publish_date, type, answer_data, summary, created_at FROM answers WHERE publish_date = ? ORDER BY type",
      publishDate
    );
    return rows.map((r) => toRow(r));
  } catch (err) {
    throw new AnswersUnavailableError(`getAnswersByDate(${publishDate})`, err);
  }
}
