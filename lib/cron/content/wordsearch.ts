/**
 * Daily Word Search themes from DeepSeek. For each date without a stored
 * row: ask for two themes (a title and ~22 words each) in strict JSON, keep
 * only dictionary words of 3–12 letters that aren't blocked (validate.ts),
 * build the 12×12 grid in code (generateWordSearch checks every line for
 * blocked letters in all 8 directions and that each word appears exactly
 * once), and store it. One bad word only drops that word (a theme needs 14
 * usable ones) and the second theme backs up the first, so a single reply
 * rarely fails outright. Bad replies are retried, then the date is left for
 * the next run; every rejection reason goes into the returned lines
 * (cron_runs.detail).
 *
 * Dates that are today or earlier get the fallback-bank grid instead: the
 * page has been showing exactly that grid since midnight, and a new theme
 * mid-day would swap the puzzle under people's fingers.
 */
import { todayISO } from "@/lib/dates";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { generateDailyWordSearch, type DailyWordSearch } from "@/lib/games/dailyPuzzles";
import { generateWordSearch, puzzleProblems, type Theme } from "@/lib/games/wordsearch/generate";
import { DAILY_SIZE } from "@/lib/games/wordsearch/daily";
import { THEMES } from "@/lib/games/wordsearch/themes";
import { cleanThemeWords, themeProblems } from "@/lib/games/wordsearch/validate";
import { rejectionLine } from "./rejections";
import { recentRows, storedDates, storeRows } from "./store";

const GAME = "word-search";
export const TRIES = 3;
/** Themes asked for per call: the first one that validates and fills a grid wins. */
const THEMES_PER_CALL = 2;
const TOKENS = 2000;
/** Generate at most this far ahead. */
const AHEAD_DAYS = 7;

type Ask = <T>(job: string, prompt: string, maxTokens?: number) => Promise<T>;

export function prompt(date: string, avoidTitles: string[]): string {
  return `Create ${THEMES_PER_CALL} different themes for a family-friendly daily word search puzzle (date ${date}). We use the first one that passes our checks.

Return ONLY JSON: {"themes": [{"title": "<2-4 word theme title>", "words": ["word", ...]}, ...]}

Rules for each theme:
- "title": a short, catchy theme title in Title Case, letters and spaces only (an apostrophe, hyphen or & is fine), at most 30 characters, no digits or other punctuation.
- "words": 22 different words that clearly belong to the theme.
- Every word is ONE common English dictionary word: lowercase letters only, 3 to 12 letters, no spaces, hyphens, proper nouns, brand names or abbreviations. Two-word phrases ("ice cream") don't count: leave them out.
- No word may contain another word from the list (no "star" and "starfish").
- Keep it friendly for all ages: nothing violent, rude or upsetting.
- Pick themes different from these recent ones: ${avoidTitles.length ? avoidTitles.join("; ") : "(none)"}.

Example of one theme (pick others): {"title": "Rainy Day", "words": ["umbrella", "puddle", "raincoat", "thunder", "cloud", "drizzle", "boots", "storm", "window", "droplet", "gutter", "splash", "soggy", "drench", "shower", "misty", "breeze", "rainbow", "galoshes", "lightning", "forecast", "damp"]}`;
}

/** Curly quotes, stray punctuation and spacing out of a title; "" when nothing usable is left. */
export function cleanTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[’‘]/g, "'")
    .replace(/[^A-Za-z' &-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-z]+/, "");
}

/** A reply's themes, cleaned; `problems` says why each one can't be used (empty = usable). */
export function themesFromReply(out: unknown, avoidTitles: string[]): { theme: Theme; problems: string[] }[] {
  const o = (out ?? {}) as { themes?: unknown; title?: unknown; words?: unknown };
  const list: unknown[] = Array.isArray(o.themes) ? o.themes : [o];
  const avoid = new Set(avoidTitles.map((t) => t.toLowerCase()));
  return list.slice(0, THEMES_PER_CALL + 1).map((item) => {
    const t = (item ?? {}) as { title?: unknown; words?: unknown };
    const raw: unknown[] = Array.isArray(t.words) ? t.words : [];
    const theme = { title: cleanTitle(t.title), words: cleanThemeWords(raw) };
    const problems = themeProblems(theme);
    if (avoid.has(theme.title.toLowerCase())) problems.push("repeats a recent theme");
    if (problems.some((p) => p.startsWith("only"))) {
      const bad = raw.filter((w) => typeof w !== "string" || !theme.words.includes(w.trim().toLowerCase()));
      if (bad.length) problems.push(`dropped ${bad.slice(0, 5).map(String).join(", ")}`);
    }
    return { theme, problems: problems.map((p) => `"${theme.title || "?"}": ${p}`) };
  });
}

/** One usable theme from DeepSeek, or null (for callers that don't need the reasons). */
export async function themeFromModel(date: string, avoidTitles: string[], ask: Ask = deepSeekJson): Promise<Theme | null> {
  const out = await ask<unknown>("content:word-search", prompt(date, avoidTitles), TOKENS);
  return themesFromReply(out, avoidTitles).find((t) => !t.problems.length)?.theme ?? null;
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

export interface WordSearchResult {
  puzzle: DailyWordSearch | null;
  reasons: string[];
  calls: number;
}

/** Up to TRIES calls, each offering THEMES_PER_CALL themes, until one fills a valid grid. */
export async function wordSearchFor(date: string, avoidTitles: string[], ask: Ask = deepSeekJson): Promise<WordSearchResult> {
  const reasons: string[] = [];
  let calls = 0;
  for (let i = 1; i <= TRIES; i++) {
    calls++;
    let out: unknown;
    try {
      out = await ask<unknown>("content:word-search", prompt(date, avoidTitles), TOKENS);
    } catch (err) {
      reasons.push(`call ${i}: ${(err as Error).message}`);
      continue;
    }
    for (const { theme, problems } of themesFromReply(out, avoidTitles)) {
      if (problems.length) {
        reasons.push(`call ${i}: ${problems.join("; ")}`);
        continue;
      }
      const made = dailyGridFor(date, theme);
      if (made) return { puzzle: made, reasons, calls };
      reasons.push(`call ${i}: "${theme.title}": no valid ${DAILY_SIZE}x${DAILY_SIZE} grid`);
    }
  }
  for (const r of reasons) console.warn(`word-search ${date}: ${r}`);
  return { puzzle: null, reasons, calls };
}

/** Store missing daily grids; returns what it wrote, plus a rejection line for each date that needed retries or failed. */
export async function ensureWordSearchPuzzles(dates: string[], ask: Ask = deepSeekJson): Promise<string[]> {
  const today = todayISO();
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + AHEAD_DAYS * 86_400_000).toISOString().slice(0, 10);
  const wanted = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= limit).sort();
  const have = await storedDates(GAME, wanted);
  const canGenerate = ask !== deepSeekJson || hasDeepSeek();
  const rows: { date: string; data: DailyWordSearch }[] = [];
  const written: string[] = [];
  const notes: string[] = [];
  for (const date of wanted) {
    if (have.has(date)) continue;
    if (date <= today || !canGenerate) {
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
    const { puzzle: made, reasons, calls } = await wordSearchFor(date, avoidTitles, ask);
    if (made) {
      rows.push({ date, data: made });
      written.push(`${GAME} ${date} (${made.title})`);
    }
    const line = rejectionLine(GAME, date, reasons, calls, Boolean(made));
    if (line) notes.push(line);
  }
  await storeRows(GAME, rows);
  return [...written, ...notes];
}
