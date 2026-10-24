import { shiftISODate, todayISO } from "./dates";

/**
 * Paths that change from one UTC day to the next — refreshed on demand by
 * app/api/revalidate (the rollover Cron Trigger just after midnight UTC) and
 * by the answers/explain crons after they write today's rows, instead of
 * hourly ISR.
 */

/** Pages that render "today" (today's puzzle, today's answers, sitemap). */
export const TODAY_PATHS = [
  "/",
  "/wordle-answer/today",
  "/wordle-free",
  "/free-nyt-games-alternative",
  "/nyt-mini-crossword-free",
  "/free-crossword-puzzle-daily",
  "/play/sudoku",
  "/play/solitaire",
  "/play/freecell",
  "/play/minesweeper",
  "/play/mahjong",
  "/play/wordle",
  "/play/mini",
  "/play/connections",
  "/play/spelling-bee",
  "/play/strands",
  "/play/letter-boxed",
  "/play/quordle",
  "/play/worldle",
  "/play/nerdle",
  "/sitemap.xml",
];

/**
 * Date pages backed by the answers table: they show "posted soon" until the
 * day's row exists, and 404 beyond tomorrow (isServedAnswerDate).
 */
export const ANSWER_DATE_ROUTES = ["/connections-answers", "/nyt-crossword-answers"];

/**
 * Every path to refresh for a run: today's pages + the answer pages for
 * yesterday (catches a missed refresh after the previous content run), today,
 * tomorrow (brings it into isServedAnswerDate range) and any extra `dates`.
 */
export function pathsToRevalidate(dates: string[] = []): string[] {
  const today = todayISO();
  const days = new Set([shiftISODate(today, -1), today, shiftISODate(today, 1), ...dates]);
  return [
    ...TODAY_PATHS,
    ...ANSWER_DATE_ROUTES.flatMap((base) => [...days].map((d) => `${base}/${d}`)),
  ];
}
