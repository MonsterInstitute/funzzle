/**
 * Funzzle Rating: an Elo-style number per game, kept locally. Each finished
 * puzzle is a "match" against the puzzle's own rating (set by difficulty);
 * the score blends winning, speed against today's players, and how much help
 * was used.
 */
import { readJson, writeJson } from "./storage";

export const START_RATING = 1200;
const K = 32;

interface RatingRecord {
  rating: number;
  games: number;
  history: { date: string; delta: number }[];
}

export type Ratings = Record<string, RatingRecord>;
const KEY = "fz:ratings";

export function getRating(game: string): RatingRecord {
  return readJson<Ratings>(KEY, {})[game] ?? { rating: START_RATING, games: 0, history: [] };
}

export function allRatings(): Ratings {
  return readJson<Ratings>(KEY, {});
}

export interface MatchInput {
  puzzleRating: number;
  won: boolean;
  /** Share of today's players beaten, 0–100; undefined when unknown. */
  percentile?: number;
  hints: number;
  mistakes: number;
}

/** Score in [0, 1] for one finished (or abandoned) puzzle. */
export function matchScore({ won, percentile, hints, mistakes }: MatchInput): number {
  if (!won) return 0;
  const speed = percentile === undefined ? 0.5 : percentile / 100;
  const score = 0.55 + 0.45 * speed - 0.12 * hints - 0.04 * mistakes;
  return Math.min(1, Math.max(0.1, score));
}

export function ratingDelta(rating: number, input: MatchInput, games = 10): number {
  const expected = 1 / (1 + 10 ** ((input.puzzleRating - rating) / 400));
  // New players move faster until their rating settles.
  const k = games < 10 ? K * 1.5 : K;
  return Math.round(k * (matchScore(input) - expected));
}

/** Apply one match and return the change. Idempotent per (game, date) key. */
export function recordMatch(game: string, date: string, input: MatchInput): { rating: number; delta: number } {
  const all = readJson<Ratings>(KEY, {});
  const rec = all[game] ?? { rating: START_RATING, games: 0, history: [] };
  const already = rec.history.find((h) => h.date === date);
  if (already) return { rating: rec.rating, delta: already.delta };
  const delta = ratingDelta(rec.rating, input, rec.games);
  rec.rating = Math.max(100, rec.rating + delta);
  rec.games += 1;
  rec.history = [...rec.history, { date, delta }].slice(-60);
  all[game] = rec;
  writeJson(KEY, all);
  return { rating: rec.rating, delta };
}
