/**
 * Mode metadata and puzzle types, with no word lists attached, so every
 * screen (Geo included) can import it without pulling in the dictionaries.
 */
export type WordMode = "classic" | "quad" | "geo" | "math";
export const WORD_MODES: WordMode[] = ["classic", "quad", "geo", "math"];

/** Free coach hints per puzzle (an opt-in rewarded ad can add one more). */
export const MAX_HINTS = 3;

export interface ModeInfo {
  /** Game-screen title. */
  title: string;
  /** Short name for chips, share text and the mode switcher. */
  short: string;
  path: string;
  rows: number;
  boards: number;
  length: number;
  /** One line for the screen subtitle. */
  blurb: string;
}

export const MODE_INFO: Record<WordMode, ModeInfo> = {
  classic: { title: "Funzzle Word", short: "Classic", path: "/play/word", rows: 6, boards: 1, length: 5, blurb: "One word, six guesses" },
  quad: { title: "Word Quad", short: "Quad", path: "/play/word/quad", rows: 9, boards: 4, length: 5, blurb: "Four words, nine guesses" },
  geo: { title: "Word Geo", short: "Geo", path: "/play/word/geo", rows: 6, boards: 1, length: 0, blurb: "Find the country" },
  math: { title: "Word Math", short: "Math", path: "/play/word/math", rows: 6, boards: 1, length: 8, blurb: "Find the equation" },
};

/** The puzzle a mode plays: grid answers (lowercase), or a Geo country. */
export type WordPuzzle =
  | { mode: "classic" | "quad" | "math"; answers: string[] }
  | { mode: "geo"; slug: string; shape: string };

export interface DailyWord {
  date: string;
  puzzle: WordPuzzle;
}
