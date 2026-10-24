/**
 * Games that submit anonymous daily results, with the variants they accept
 * and the range of their recap histogram. Shared by /api/results and the
 * recap screen so both bucket results the same way.
 *
 * Most games compare times (lower is better). A `kind: "score"` game compares
 * points (higher is better): its results keep the score in the same value
 * column (game_results.time_ms, challenge_entries.time_ms), and `lo`, `hi` and
 * `minMs` are in points. No schema change, and time games are untouched.
 */
export interface ResultGame {
  variants: string[];
  /** Histogram range, ms (points for score games). Outliers land in the end buckets. */
  lo: number;
  hi: number;
  /** Values below this are rejected as impossible (ms, or points for score games). */
  minMs: number;
  /** "score": higher is better. Default "time": lower is better. */
  kind?: "time" | "score";
}

export const RESULT_GAMES: Record<string, ResultGame> = {
  sudoku: { variants: [""], lo: 60_000, hi: 1_500_000, minMs: 15_000 },
  solitaire: { variants: ["draw1", "draw3"], lo: 60_000, hi: 900_000, minMs: 20_000 },
  "2048": { variants: [""], lo: 0, hi: 28_000, minMs: 1, kind: "score" },
  "block-puzzle": { variants: [""], lo: 0, hi: 1_400, minMs: 1, kind: "score" },
  jigsaw: { variants: [""], lo: 60_000, hi: 1_200_000, minMs: 20_000 },
};

/** Highest score accepted from a score game; anything above isn't a real game. */
export const MAX_SCORE = 10_000_000;

/** True for games whose results are points, higher is better. */
export function isScoreGame(game: string): boolean {
  return RESULT_GAMES[game]?.kind === "score";
}

/**
 * The compared value of a submitted result: `score` for score games, `timeMs`
 * otherwise. Null when missing, not an integer, or outside the game's range.
 */
export function resultValue(game: string, body: { timeMs?: unknown; score?: unknown }): number | null {
  const config = RESULT_GAMES[game];
  if (!config) return null;
  const v = config.kind === "score" ? body.score : body.timeMs;
  const max = config.kind === "score" ? MAX_SCORE : 86_400_000;
  return typeof v === "number" && Number.isInteger(v) && v >= config.minMs && v <= max ? v : null;
}

/** Did value `a` beat value `b`? Lower times win; higher scores win. */
export function beats(game: string, a: number, b: number): boolean {
  return isScoreGame(game) ? a > b : a < b;
}

export const HISTOGRAM_BUCKETS = 14;
