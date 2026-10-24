/**
 * Anonymous daily results: submit a finish, get "faster than N% of today's
 * players" (or "a higher score than", for score games) and the day's
 * histogram back.
 */
import { clientId } from "./storage";

export interface DayStats {
  count: number;
  /** Bucket counts between lo and hi (ms); outliers sit in the end buckets. */
  buckets: number[];
  lo: number;
  hi: number;
  /** What the buckets measure: times (ms) or scores (points). */
  histogram?: "time" | "score";
}

export interface SubmitResult extends DayStats {
  /** Share of other players this time beat, 0–100; null when you're the first. */
  percentile: number | null;
}

export async function submitResult(input: {
  game: string;
  date: string;
  variant?: string;
  timeMs: number;
  mistakes: number;
  hints: number;
  moves?: number;
  /** Score games (resultConfig kind "score"): the points that are compared. */
  score?: number;
}): Promise<SubmitResult | null> {
  try {
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, variant: input.variant ?? "", clientId: clientId() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SubmitResult;
  } catch {
    return null;
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "12,480"-style points for score games. */
export function formatScore(points: number): string {
  return Math.round(points).toLocaleString("en-US");
}

/** "06:12"-style clock for the in-game timer chip. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
