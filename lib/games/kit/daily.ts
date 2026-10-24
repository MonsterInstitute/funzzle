/**
 * Daily Set, per-day results and streaks, kept in local storage.
 *
 * The Daily Set is four of the day's daily puzzles. A streak day is any UTC
 * day on which at least one Daily Set puzzle was finished, so the four games
 * share one streak.
 */
import { readJson, writeJson } from "./storage";

export const DAILY_SET = ["sudoku", "solitaire", "word", "mini-crossword"] as const;
export type DailySetGame = (typeof DAILY_SET)[number];

export interface DailyResult {
  timeMs?: number;
  mistakes?: number;
  hints?: number;
  /** Share of today's players this result beat, 0–100. */
  percentile?: number;
  ratingDelta?: number;
  label?: string;
}

export interface DailyStatus {
  state: "playing" | "done";
  /** Short progress line for the homepage card, e.g. "Guess 3 of 6". */
  meta?: string;
  result?: DailyResult;
}

type DaysRecord = Record<string, Record<string, DailyStatus>>;

const DAYS_KEY = "fz:days";
const KEEP_DAYS = 400;
export const PROGRESS_EVENT = "fz:progress";

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function readDays(): DaysRecord {
  return readJson<DaysRecord>(DAYS_KEY, {});
}

export function getDayStatus(date: string): Record<string, DailyStatus> {
  return readDays()[date] ?? {};
}

export function getStatus(game: string, date: string): DailyStatus | undefined {
  return getDayStatus(date)[game];
}

/** Record progress or a finish; a finished game is never downgraded to "playing". */
export function setStatus(game: string, date: string, status: DailyStatus): void {
  const days = readDays();
  const day = (days[date] ??= {});
  if (day[game]?.state === "done" && status.state !== "done") return;
  day[game] = status;
  const dates = Object.keys(days).sort();
  for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) delete days[old];
  writeJson(DAYS_KEY, days);
  try {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    // Not in a browser.
  }
}

export function markDone(game: string, date: string, result: DailyResult = {}): void {
  setStatus(game, date, { state: "done", result });
}

function playedSetOn(days: DaysRecord, date: string): boolean {
  const day = days[date];
  return !!day && DAILY_SET.some((g) => day[g]?.state === "done");
}

export interface StreakInfo {
  current: number;
  best: number;
  /** Mon..Sun of the current UTC week: "done" | "today" | "open" | "future". */
  week: ("done" | "today" | "open" | "future")[];
}

export function getStreak(today = utcToday()): StreakInfo {
  const days = readDays();
  // Today not played yet keeps yesterday's streak alive.
  let cursor = playedSetOn(days, today) ? today : shiftDay(today, -1);
  let current = 0;
  while (playedSetOn(days, cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of Object.keys(days).sort()) {
    if (!playedSetOn(days, date)) continue;
    run = prev && shiftDay(prev, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const monday = shiftDay(today, -weekday);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(monday, i);
    if (playedSetOn(days, date)) return "done" as const;
    if (date === today) return "today" as const;
    return date < today ? ("open" as const) : ("future" as const);
  });
  return { current, best: Math.max(best, current), week };
}

export function dailySetProgress(date = utcToday()): number {
  const day = getDayStatus(date);
  return DAILY_SET.filter((g) => day[g]?.state === "done").length;
}
