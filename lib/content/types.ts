/**
 * Local content types. These files are the source of truth for seeded content:
 * pages read them as a fallback when Supabase has no row (or is unreachable),
 * and scripts/seed generate the matching Supabase rows from them.
 */

export interface MiniClueEntry {
  number: number;
  clue: string;
  answer: string;
  explanation: string;
}

export interface DayMini {
  across: MiniClueEntry[];
  down: MiniClueEntry[];
}

export interface WordleDay {
  answer: string;
  hint_first_letter: string;
  hint_vowels: number;
}

export interface DayContent {
  /** YYYY-MM-DD */
  date: string;
  mini: DayMini;
  miniSummary: string;
  wordle: WordleDay;
  wordleSummary: string;
}

export interface ClueEntry {
  /** URL slug, kebab-case, e.g. "capital-of-france". */
  slug: string;
  clue_text: string;
  answer: string;
  source: string;
  /** 2-3 sentences: etymology, usage, interesting facts. */
  explanation: string;
  /** Dates (YYYY-MM-DD) whose puzzles this clue appeared in. */
  appearances: string[];
}
