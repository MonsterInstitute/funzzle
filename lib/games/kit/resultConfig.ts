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
  /** How results rank (default "time"); see ResultOrder. */
  order?: ResultOrder;
  /**
   * What the recap histogram buckets (default "time", lo/hi in ms). "score":
   * the `moves` value, lo/hi in points — for games where time doesn't matter.
   */
  histogram?: "time" | "score";
  /** Unit of `moves` for "fewest" games, singular and plural (default word/words). */
  unit?: [string, string];
}

/**
 * How a game's results rank — the single source of truth for /api/results
 * percentiles, challenge head-to-heads and league boards.
 *   "time"      faster wins.
 *   "score"     higher `moves` (the game's score) wins; ties: faster.
 *   "fewest"    fewer `moves` (words, guesses) wins; ties: faster.
 *   "mistakes"  fewer mistakes, then fewer hints, then faster.
 * Scores/counts live in the existing `moves` column: no schema change.
 */
export type ResultOrder = "time" | "score" | "fewest" | "mistakes";

export const RESULT_GAMES: Record<string, ResultGame> = {
  sudoku: { variants: [""], lo: 60_000, hi: 1_500_000, minMs: 15_000 },
  solitaire: { variants: ["draw1", "draw3"], lo: 60_000, hi: 900_000, minMs: 20_000 },
  freecell: { variants: [""], lo: 60_000, hi: 900_000, minMs: 20_000 },
  // Variant = level; only the Intermediate daily board submits today. A
  // no-guess 16×16 clear takes fast players about a minute, most 3–10.
  minesweeper: { variants: ["beginner", "intermediate", "expert"], lo: 60_000, hi: 900_000, minMs: 10_000 },
  // Daily Mahjong is always the 144-tile Turtle (variant = layout id): 72
  // matches take a quick player about 4 minutes, most players 6–20.
  mahjong: { variants: ["turtle"], lo: 120_000, hi: 1_500_000, minMs: 45_000 },
  // A Spider win takes 100+ moves even with one suit; four suits can take an hour.
  "spider-solitaire": { variants: ["suits1", "suits2", "suits4"], lo: 120_000, hi: 2_400_000, minMs: 40_000 },
  // Score = points when the player finished; the histogram is of times.
  "spelling-hive": { variants: [""], lo: 120_000, hi: 2_700_000, minMs: 10_000, order: "score" },
  // moves = words used.
  "letter-box": { variants: [""], lo: 30_000, hi: 900_000, minMs: 10_000, order: "fewest" },
  groups: { variants: [""], lo: 30_000, hi: 900_000, minMs: 8_000, order: "mistakes" },
  // Daily chess puzzles rank like Groups: fewest wrong moves, then hints, then time.
  chess: { variants: [""], lo: 5_000, hi: 420_000, minMs: 2_000, order: "mistakes" },
  "mini-crossword": { variants: [""], lo: 20_000, hi: 600_000, minMs: 5_000 },
  word: { variants: ["classic", "quad", "geo", "math"], lo: 15_000, hi: 600_000, minMs: 2_000, order: "fewest", unit: ["guess", "guesses"] },
  "word-hunt": { variants: [""], lo: 60_000, hi: 900_000, minMs: 15_000 },
};

export const HISTOGRAM_BUCKETS = 14;

/** Ranking for games outside RESULT_GAMES too (challenges, leagues). */
export function resultOrder(game: string): ResultOrder {
  return RESULT_GAMES[game]?.order ?? "time";
}

export interface RankedResult {
  timeMs: number;
  moves?: number | null;
  mistakes?: number;
  hints?: number;
}

/** Negative when `a` ranks ahead of `b`. */
export function compareResults(game: string, a: RankedResult, b: RankedResult): number {
  const order = resultOrder(game);
  if (order === "mistakes") {
    const d = (a.mistakes ?? 0) - (b.mistakes ?? 0) || (a.hints ?? 0) - (b.hints ?? 0);
    if (d) return d;
  } else if (order !== "time") {
    const d = (a.moves ?? 0) - (b.moves ?? 0);
    if (d) return order === "score" ? -d : d;
  }
  return a.timeMs - b.timeMs;
}

/** SQL ORDER BY for challenge entries / results of `game` (columns moves, mistakes, hints, time_ms). */
export function resultOrderSql(game: string): string {
  const order = resultOrder(game);
  if (order === "score") return "moves DESC, time_ms";
  if (order === "fewest") return "moves, time_ms";
  if (order === "mistakes") return "mistakes, hints, time_ms";
  return "time_ms";
}

/**
 * SQL condition: result `r` ranks below result `me` (both rows of
 * game_results). Used to count the players a result beat.
 */
export function beatenSql(game: string): string {
  const order = resultOrder(game);
  if (order === "score") return "(r.moves < me.moves OR (r.moves = me.moves AND r.time_ms > me.time_ms))";
  if (order === "fewest") return "(r.moves > me.moves OR (r.moves = me.moves AND r.time_ms > me.time_ms))";
  if (order === "mistakes")
    return "(r.mistakes > me.mistakes OR (r.mistakes = me.mistakes AND (r.hints > me.hints OR (r.hints = me.hints AND r.time_ms > me.time_ms))))";
  return "r.time_ms > me.time_ms";
}

/** The headline number of a result: "142 pts", "2 words" or the time. */
export function resultHeadline(game: string, r: RankedResult, formatTime: (ms: number) => string): string {
  const order = resultOrder(game);
  const n = r.moves ?? 0;
  if (order === "score") return `${n} pt${n === 1 ? "" : "s"}`;
  if (order === "fewest") {
    const [one, many] = RESULT_GAMES[game]?.unit ?? ["word", "words"];
    return `${n} ${n === 1 ? one : many} · ${formatTime(r.timeMs)}`;
  }
  if (order === "mistakes") return `${r.mistakes ?? 0} mistake${r.mistakes === 1 ? "" : "s"} · ${formatTime(r.timeMs)}`;
  return formatTime(r.timeMs);
}

/** Whether `a` ranks strictly above `b`. */
export function beats(game: string, a: RankedResult, b: RankedResult): boolean {
  return compareResults(game, a, b) < 0;
}
