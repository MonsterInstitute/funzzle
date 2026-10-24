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
   * How "faster than N%" ranks: "time" (default) by time alone; "mistakes"
   * by fewest mistakes, then fewest hints, then time (Groups, where a fast
   * solve full of wrong guesses shouldn't beat a clean one).
   */
  rank?: "time" | "mistakes";
}

export const RESULT_GAMES: Record<string, ResultGame> = {
  sudoku: { variants: [""], lo: 60_000, hi: 1_500_000, minMs: 15_000 },
  solitaire: { variants: ["draw1", "draw3"], lo: 60_000, hi: 900_000, minMs: 20_000 },
  groups: { variants: [""], lo: 30_000, hi: 900_000, minMs: 8_000, rank: "mistakes" },
};

export const HISTOGRAM_BUCKETS = 14;

/**
 * SQL counting the day's results ranked below client ?4's stored result
 * (params: ?1 game, ?2 date, ?3 variant, ?4 client id).
 */
export function belowSql(rank: ResultGame["rank"] = "time"): string {
  const mine = (col: string) => `(SELECT ${col} FROM game_results WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3 AND client_id = ?4)`;
  const worse =
    rank === "mistakes"
      ? `(mistakes > ${mine("mistakes")}
          OR (mistakes = ${mine("mistakes")} AND hints > ${mine("hints")})
          OR (mistakes = ${mine("mistakes")} AND hints = ${mine("hints")} AND time_ms > ${mine("time_ms")}))`
      : `time_ms > ${mine("time_ms")}`;
  return `SELECT count(*) AS slower FROM game_results
       WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3
         AND ${worse}`;
}
