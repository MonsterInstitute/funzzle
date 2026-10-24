/**
 * Daily Word Search themes from DeepSeek. For each date without a stored
 * row: ask for a theme title and ~20 words in strict JSON, keep only
 * dictionary words of 3–12 letters that aren't blocked (validate.ts), build
 * the 12×12 grid in code (generateWordSearch checks every line for blocked
 * letters in all 8 directions and that each word appears exactly once), and
 * store it. Bad replies are retried, then the date is left for the next run.
 *
 * Dates that are today or earlier get the fallback-bank grid instead: the
 * page has been showing exactly that grid since midnight, and a new theme
 * mid-day would swap the puzzle under people's fingers.
 *
 * Not wired into a cron here: the explain cron calls
 * ensureWordSearchPuzzles([today, tomorrow, …]).
 */
import { todayISO } from "@/lib/dates";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { generateDailyWordSearch, type DailyWordSearch } from "@/lib/games/dailyPuzzles";
import { generateWordSearch, puzzleProblems, type Theme } from "@/lib/games/wordsearch/generate";
import { DAILY_SIZE } from "@/lib/games/wordsearch/daily";
import { THEMES } from "@/lib/games/wordsearch/themes";
import { cleanThemeWords, themeProblems } from "@/lib/games/wordsearch/validate";
import { recentRows, storedDates, storeRows } from "./store";

const GAME = "word-search";
const TRIES = 3;
/** Generate at most this far ahead. */
const AHEAD_DAYS = 7;

function prompt(date: string, avoidTitles: string[]): string {
  return `Create the theme for a family-friendly daily word search puzzle (date ${date}).

Return ONLY JSON: {"title": "<2-4 word theme title>", "words": ["word", ...]}

Rules:
- "title": a short, catchy theme title in Title Case, letters and spaces only (an apostrophe or & is fine), under 30 characters.
- "words": exactly 20 different words that clearly belong to the theme.
- Every word is ONE ordinary English dictionary word: lowercase letters only, 3 to 12 letters, no spaces, hyphens, proper nouns, brand names or abbreviations.
- No word may contain another word from the list (no "star" and "stars").
- Keep it friendly for all ages: nothing violent, rude or upsetting.
- Pick a theme different from these recent ones: ${avoidTitles.length ? avoidTitles.join("; ") : "(none)"}.`;
}

/** One theme from DeepSeek, cleaned and validated; null when the reply is unusable. */
export async function themeFromModel(date: string, avoidTitles: string[]): Promise<Theme | null> {
  const out = await deepSeekJson<{ title?: unknown; words?: unknown }>("content:word-search", prompt(date, avoidTitles), 800);
  const title = typeof out.title === "string" ? out.title.trim() : "";
  const words = cleanThemeWords(Array.isArray(out.words) ? out.words : []);
  const theme = { title, words };
  if (themeProblems(theme).length) return null;
  if (avoidTitles.some((t) => t.toLowerCase() === title.toLowerCase())) return null;
  return theme;
}

/** A validated daily grid for `theme`, or null. */
export function dailyGridFor(date: string, theme: Theme): DailyWordSearch | null {
  try {
    const p = generateWordSearch(`word-search:${date}`, theme, DAILY_SIZE);
    return puzzleProblems(p).length ? null : { date, source: "llm", ...p };
  } catch {
    return null;
  }
}

export async function ensureWordSearchPuzzles(dates: string[]): Promise<string[]> {
  const today = todayISO();
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + AHEAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const wanted = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= limit).sort();
  const have = await storedDates(GAME, wanted);
  const rows: { date: string; data: DailyWordSearch }[] = [];
  const written: string[] = [];
  for (const date of wanted) {
    if (have.has(date)) continue;
    if (date <= today || !hasDeepSeek()) {
      // Today and earlier: keep what the page already shows. Without a key the
      // page's bank fallback is the puzzle; nothing to store ahead of time.
      if (date <= today) {
        rows.push({ date, data: generateDailyWordSearch(date) });
        written.push(`${GAME} ${date} (bank)`);
      }
      continue;
    }
    const recent = await recentRows<DailyWordSearch>(GAME, date, 45).catch(() => []);
    const avoidTitles = [...recent.map((r) => r.title), ...rows.map((r) => r.data.title), ...THEMES.map((t) => t.title)].slice(0, 120);
    let made: DailyWordSearch | null = null;
    for (let i = 0; i < TRIES && !made; i++) {
      try {
        const theme = await themeFromModel(date, avoidTitles);
        if (theme) made = dailyGridFor(date, theme);
      } catch (err) {
        console.warn(`word-search ${date}: ${(err as Error).message}`);
      }
    }
    if (made) {
      rows.push({ date, data: made });
      written.push(`${GAME} ${date} (${made.title})`);
    } else {
      console.warn(`word-search ${date}: no valid theme after ${TRIES} tries; the bank covers it`);
    }
  }
  await storeRows(GAME, rows);
  return written;
}
