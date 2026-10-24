/** A theme before it has a grid: what the bank and the daily content job author. */
export interface WordHuntTheme {
  /** Stable id (bank themes) or the date (daily AI themes). */
  id: string;
  /** The clue shown above the board, e.g. "Morning rituals". */
  title: string;
  /** The word that touches two opposite sides of the board. */
  span: string;
  /** The other theme words (5–8). Together with `span`: exactly 48 letters. */
  words: string[];
}

export interface PlacedWord {
  /** Uppercase. */
  word: string;
  /** Cells in reading order. */
  path: number[];
  span: boolean;
}

/** Everything the browser needs to play one puzzle. */
export interface WordHuntPuzzle {
  id: string;
  title: string;
  /** 48 uppercase letters, row-major, 6 columns × 8 rows. */
  grid: string;
  /** Theme words in the theme's order; exactly one has span: true. */
  words: PlacedWord[];
  /**
   * Every other accepted word (lowercase, ≥ 4 letters, valid tier) that can be
   * traced in this grid: the bonus words that fill the hint meter. Shipped with
   * the puzzle so the browser never loads the full word list.
   */
  bonus: string[];
}
