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
}

export const RESULT_GAMES: Record<string, ResultGame> = {
  sudoku: { variants: [""], lo: 60_000, hi: 1_500_000, minMs: 15_000 },
  solitaire: { variants: ["draw1", "draw3"], lo: 60_000, hi: 900_000, minMs: 20_000 },
  freecell: { variants: [""], lo: 60_000, hi: 900_000, minMs: 20_000 },
};

export const HISTOGRAM_BUCKETS = 14;
