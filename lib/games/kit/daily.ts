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

export type WeekDay = "done" | "frozen" | "today" | "open" | "future";

export interface StreakInfo {
  current: number;
  best: number;
  /** Streak freezes banked: one is earned every 7 streak days (max MAX_FREEZES). */
  freezes: number;
  /** Missed days a freeze covered, so the streak carried on. */
  frozen: string[];
  /** Mon..Sun of the current UTC week. */
  week: WeekDay[];
}

export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

/**
 * Streak with freezes. Replays every day from the first played day: each
 * played day extends the run, and every FREEZE_EVERY-th day of a run banks a
 * freeze. A missed day spends a banked freeze automatically (the run carries
 * on, but the day doesn't add to it); with none banked the run resets.
 * Today, not played yet, never breaks anything. Pure function of the stored
 * days, so it needs no state of its own.
 */
export function getStreak(today = utcToday()): StreakInfo {
  const days = readDays();
  const played = Object.keys(days).filter((d) => d <= today && playedSetOn(days, d)).sort();
  let run = 0;
  let best = 0;
  let freezes = 0;
  const frozen: string[] = [];
  if (played.length) {
    for (let date = played[0]; date <= today; date = shiftDay(date, 1)) {
      if (playedSetOn(days, date)) {
        run++;
        best = Math.max(best, run);
        if (run % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      } else if (date === today) {
        break;
      } else if (run > 0 && freezes > 0) {
        freezes--;
        frozen.push(date);
      } else {
        run = 0;
      }
    }
  }
  const frozenSet = new Set(frozen);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  const monday = shiftDay(today, -weekday);
  const week = Array.from({ length: 7 }, (_, i): WeekDay => {
    const date = shiftDay(monday, i);
    if (playedSetOn(days, date)) return "done";
    if (frozenSet.has(date)) return "frozen";
    if (date === today) return "today";
    return date < today ? "open" : "future";
  });
  return { current: run, best, freezes, frozen, week };
}

export function dailySetProgress(date = utcToday()): number {
  const day = getDayStatus(date);
  return DAILY_SET.filter((g) => day[g]?.state === "done").length;
}

/** Days on which all four Daily Set puzzles were finished. */
export function fullSetDays(): number {
  const days = readDays();
  return Object.values(days).filter((day) => DAILY_SET.every((g) => day[g]?.state === "done")).length;
}
