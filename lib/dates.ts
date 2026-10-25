/**
 * Date helpers shared across pages and the sitemap.
 * All puzzle dates are handled as UTC calendar days (YYYY-MM-DD) to avoid
 * timezone drift between the server and the stored publish_date column.
 */

/** Format a Date as an ISO calendar day, e.g. "2026-07-01". */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar day in UTC as YYYY-MM-DD. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse a YYYY-MM-DD string into a UTC Date at midnight. */
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** True when the string is a valid YYYY-MM-DD calendar day. */
export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. */
export function shiftISODate(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Human-friendly date, e.g. "July 1, 2026". */
export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The last `count` calendar days ending today, newest first. */
export function recentDates(count: number): string[] {
  const today = todayISO();
  return Array.from({ length: count }, (_, i) => shiftISODate(today, -i));
}

/**
 * Earliest date with stored answers (Wordle / NYT Mini rows start here;
 * Connections later). Backfilling older dates? Move this back too.
 */
export const FIRST_ANSWER_DATE = "2026-06-01";

/**
 * Dates the database-backed answer pages serve: from FIRST_ANSWER_DATE up to
 * tomorrow (UTC; a day of slack for time zones ahead of UTC). Anything else
 * 404s before any data fetch, so crawlers following the prev/next links can't
 * walk (and cache) an endless chain of empty pages. Future dates come into
 * range via the daily on-demand revalidation (see lib/revalidation.ts).
 */
export function isServedAnswerDate(iso: string, firstDate: string = FIRST_ANSWER_DATE): boolean {
  return (
    isValidISODate(iso) &&
    iso >= firstDate &&
    iso <= shiftISODate(todayISO(), 1)
  );
}

/**
 * Letter Boxed has no public archive (only today's and yesterday's box are
 * on NYT's page), so its stored answers start when the answers cron did.
 */
export const FIRST_LETTER_BOXED_DATE = "2026-10-23";

/** The last `count` days that are served answer dates (newest first). */
export function recentAnswerDates(count: number, firstDate: string = FIRST_ANSWER_DATE): string[] {
  return recentDates(count).filter((d) => d >= firstDate);
}
