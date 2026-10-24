/**
 * Games that submit anonymous daily results, with the variants they accept
 * and the time range of their recap histogram. Shared by /api/results and
 * the recap screen so both bucket times the same way.
 */
export interface ResultGame {
  variants: string[];
  /** Histogram range, ms. Faster/slower times land in the end buckets. */
  lo: number;
  hi: number;
  /** Times below this are rejected as impossible. */
  minMs: number;
  /**
   * How a day's results are ranked: "time" (default) = faster is better;
   * "moves" = fewer moves first (word games submit guesses used, a miss as
   * rows + 1), then faster. Results must then include `moves`.
   */
  rank?: "time" | "moves";
}

export const RESULT_GAMES: Record<string, ResultGame> = {
  sudoku: { variants: [""], lo: 60_000, hi: 1_500_000, minMs: 15_000 },
  solitaire: { variants: ["draw1", "draw3"], lo: 60_000, hi: 900_000, minMs: 20_000 },
  word: { variants: ["classic", "quad", "geo", "math"], lo: 15_000, hi: 600_000, minMs: 2_000, rank: "moves" },
};

export const HISTOGRAM_BUCKETS = 14;

export interface RankedResult {
  timeMs: number;
  moves: number | null;
}

/** Whether `a` ranks strictly above `b` (the rule /api/results applies in SQL). */
export function beats(game: string, a: RankedResult, b: RankedResult): boolean {
  if (RESULT_GAMES[game]?.rank === "moves" && (a.moves ?? Infinity) !== (b.moves ?? Infinity)) {
    return (a.moves ?? Infinity) < (b.moves ?? Infinity);
  }
  return a.timeMs < b.timeMs;
}
