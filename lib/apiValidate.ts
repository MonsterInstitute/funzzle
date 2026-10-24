/** Input checks shared by the anonymous write APIs (challenges, leagues, push). */
import { isValidISODate, todayISO } from "./dates";
import { cleanName } from "./games/kit/identity";
import { MAX_SCORE } from "./games/kit/resultConfig";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const DAY_MS = 86_400_000;

/** Games whose results can be compared (challenges, leagues). */
export const COMPETITIVE_GAMES = new Set(["sudoku", "solitaire", "spider-solitaire", "freecell", "minesweeper", "mahjong", "spelling-hive", "letter-box", "groups", "chess", "mini-crossword", "word", "word-hunt", "2048", "block-puzzle", "jigsaw"]);

export function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

export function name(value: unknown): string | null {
  const n = typeof value === "string" ? cleanName(value) : "";
  return n.length ? n : null;
}

export interface CheckedResult {
  timeMs: number;
  mistakes: number;
  hints: number;
  moves: number | null;
  /** Score games only; null otherwise. */
  score: number | null;
}

export function result(value: unknown): CheckedResult | null {
  const r = (value ?? {}) as Record<string, unknown>;
  const timeMs = intIn(r.timeMs, 1_000, DAY_MS);
  const mistakes = intIn(r.mistakes, 0, 999);
  const hints = intIn(r.hints, 0, 999);
  const moves = r.moves === undefined || r.moves === null ? null : intIn(r.moves, 0, 100_000);
  const score = r.score === undefined || r.score === null ? null : intIn(r.score, 0, MAX_SCORE);
  if (timeMs === null || mistakes === null || hints === null || (r.moves !== undefined && r.moves !== null && moves === null)) return null;
  if (r.score !== undefined && r.score !== null && score === null) return null;
  // Score games rank by their score, which lives in `moves` (resultConfig).
  return { timeMs, mistakes, hints, moves: score ?? moves, score };
}

/** A challenge puzzle spec: a past-or-today daily, or a practice seed. */
export function puzzle(value: unknown): object | null {
  const p = (value ?? {}) as Record<string, unknown>;
  if (p.kind === "daily" && typeof p.date === "string" && isValidISODate(p.date) && p.date <= todayISO() && p.date >= "2026-01-01") {
    if (p.variant !== undefined && !(typeof p.variant === "string" && /^[a-z0-9-]{0,20}$/.test(p.variant))) return null;
    return { kind: "daily", date: p.date, ...(p.variant ? { variant: p.variant } : {}) };
  }
  if (p.kind === "practice" && typeof p.seed === "string" && /^[a-z0-9:-]{1,100}$/i.test(p.seed) && typeof p.level === "string" && /^[a-z0-9-]{1,20}$/.test(p.level)) {
    return { kind: "practice", seed: p.seed, level: p.level };
  }
  return null;
}

/** Random id from an unambiguous alphabet. */
export function randomCode(length: number, alphabet = "abcdefghjkmnpqrstuvwxyz23456789"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
