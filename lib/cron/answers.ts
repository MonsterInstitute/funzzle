import { revalidatePath } from "next/cache";
import { all, exec } from "@/lib/db";
import { shiftISODate, todayISO } from "@/lib/dates";
import { ensureDailyPuzzles, spiderDaysStored } from "@/lib/games/dailyPuzzles";
import { changedUrls, submitIndexNow } from "@/lib/indexnow";
import { pathsToRevalidate } from "@/lib/revalidation";
import {
  fetchConnections,
  fetchLetterBoxed,
  fetchMini,
  fetchNerdle,
  fetchQuordle,
  fetchStrands,
  fetchWordle,
  fetchWorldle,
} from "@/scripts/fetch-public-answers.mjs";

/**
 * Fills in any missing answer rows for today and tomorrow (UTC) straight from
 * the public sources — no LLM, so it is fast and cheap — and stores Funzzle's
 * own daily puzzles. Cron "5 2,3,6,14,22,23 * * *":
 *
 *   22:05, 23:05 UTC  tomorrow's Wordle, Connections, Strands, Quordle, Worldle
 *                     and Nerdle (all published ahead) and weekend Minis
 *                     (released 18:00 ET) land BEFORE the date begins; the
 *                     00:01 revalidation publishes them.
 *   02:05, 03:05 UTC  weekday Minis, released 22:00 ET (02:00 UTC in EDT,
 *                     03:00 UTC in EST) — the earliest they exist anywhere.
 *   06:05, 14:05 UTC  retries. Letter Boxed changes at 3 a.m. ET (07:00/08:00
 *                     UTC) and is never published ahead, so 14:05 is the first
 *                     run that can store the UTC day's box; the page's
 *                     "yesterday" block lets a later run fill a missed day.
 *
 * Existing rows are never overwritten: the explain cron later adds DeepSeek
 * explanations to these rows in place.
 */

type Fetched = { answer_data: unknown; source: string };
interface Game {
  type: string;
  fetch: (date: string) => Promise<Fetched>;
  /** Days relative to today (UTC) to fill. */
  days: readonly number[];
  /** UTC hour from which today's row missing is a failure (alert). */
  todayDueHour: number;
}

const AHEAD = [0, 1] as const;
const GAMES: Game[] = [
  { type: "wordle", fetch: fetchWordle, days: AHEAD, todayDueHour: 0 },
  { type: "connections", fetch: fetchConnections, days: AHEAD, todayDueHour: 0 },
  { type: "nyt-mini", fetch: fetchMini, days: AHEAD, todayDueHour: 0 },
  { type: "strands", fetch: fetchStrands, days: AHEAD, todayDueHour: 0 },
  { type: "quordle", fetch: fetchQuordle, days: AHEAD, todayDueHour: 0 },
  { type: "worldle", fetch: fetchWorldle, days: AHEAD, todayDueHour: 0 },
  { type: "nerdle", fetch: fetchNerdle, days: AHEAD, todayDueHour: 0 },
  { type: "letter-boxed", fetch: fetchLetterBoxed, days: [-1, 0], todayDueHour: 9 },
];

type Result = { date: string; type: string } & (
  | { status: "present" }
  | { status: "written"; source: string }
  | { status: "missing"; error: string }
);

export interface AnswersRun {
  ok: boolean;
  today: string;
  revalidated: boolean;
  results: Result[];
  puzzles: string[] | { error: string };
  spiderDays: number | null;
  action?: string;
}

export async function runAnswersCron(): Promise<AnswersRun> {
  const today = todayISO();
  const dates = [today, shiftISODate(today, 1)];
  const queried = [shiftISODate(today, -1), ...dates];

  const existing = await all<{ publish_date: string; type: string }>(
    "SELECT publish_date, type FROM answers WHERE publish_date IN (?, ?, ?)",
    ...queried
  );
  const present = new Set(existing.map((r) => `${r.publish_date}|${r.type}`));

  const results: Result[] = await Promise.all(
    GAMES.flatMap((game) =>
      game.days.map(async (offset): Promise<Result> => {
        const date = shiftISODate(today, offset);
        if (present.has(`${date}|${game.type}`)) return { date, type: game.type, status: "present" };
        try {
          const { answer_data, source } = await game.fetch(date);
          // ON CONFLICT: another writer stored this row first — it exists,
          // which is all we need.
          const added = await exec(
            "INSERT INTO answers (publish_date, type, answer_data, summary) VALUES (?, ?, ?, NULL) ON CONFLICT(publish_date, type) DO NOTHING",
            date,
            game.type,
            JSON.stringify(answer_data)
          );
          return added ? { date, type: game.type, status: "written", source } : { date, type: game.type, status: "present" };
        } catch (err) {
          return { date, type: game.type, status: "missing", error: (err as Error).message };
        }
      })
    )
  );

  for (const r of results) {
    if (r.status === "written") console.log(`answers cron: wrote ${r.date} ${r.type} [${r.source}]`);
    if (r.status === "missing") console.warn(`answers cron: ${r.date} ${r.type} still missing — ${r.error}`);
  }

  // Tomorrow's rows need no refresh now: the 00:01 UTC revalidation publishes them.
  // A Letter Boxed row for yesterday is a live page too (pathsToRevalidate
  // covers yesterday's answer pages).
  const wroteToday = results.some((r) => r.status === "written" && r.date <= today);
  if (wroteToday) {
    for (const p of pathsToRevalidate()) revalidatePath(p);
    await submitIndexNow(changedUrls(today));
  }

  // Funzzle's own daily puzzles (Sudoku grid, Solitaire deals): stored ahead
  // of time so everyone gets the stored puzzle. Pages generate the same puzzle
  // from the same seed until the row exists, so no refresh is needed. Two days
  // ahead, so a day of failed runs never leaves a day unstored.
  let puzzles: AnswersRun["puzzles"];
  try {
    puzzles = await ensureDailyPuzzles([...dates, shiftISODate(today, 2)]);
  } catch (err) {
    puzzles = { error: (err as Error).message };
  }

  // 2- and 4-suit Spider dailies are generated offline (too heavy for a
  // Worker): fail the run, so the alert email goes out, when < 30 days remain.
  let spiderDays: number | null = null;
  try {
    spiderDays = await spiderDaysStored(today);
  } catch {
    // Reported as null; the page simply hides modes without a stored deal.
  }
  const spiderLow = spiderDays !== null && spiderDays < 30;

  // Today's answers should always exist by now; a gap is a failure (alert).
  // Tomorrow's Mini is routinely unreleased until 22:00 ET, so tomorrow's gaps
  // aren't; nor is today's Letter Boxed before NYT's 3 a.m. ET changeover
  // (todayDueHour), nor yesterday's (best effort: it may have rotated off).
  const hour = new Date().getUTCHours();
  const dueHour = new Map(GAMES.map((g) => [g.type, g.todayDueHour]));
  const todayMissing = results.some(
    (r) => r.status === "missing" && r.date === today && hour >= (dueHour.get(r.type) ?? 0)
  );
  return {
    ok: !todayMissing && !("error" in puzzles) && !spiderLow,
    today,
    revalidated: wroteToday,
    results,
    puzzles,
    spiderDays,
    ...(spiderLow ? { action: "Run: npx tsx scripts/pregenerate-spider.ts --days=365 (2- and 4-suit Spider dailies are running out)" } : {}),
  };
}
