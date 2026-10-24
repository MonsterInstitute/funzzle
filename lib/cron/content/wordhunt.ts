/**
 * Daily Word Hunt themes from DeepSeek. The model only proposes a theme and
 * its words; everything else is decided in code: strict validation (shape,
 * dictionary, blocked words, exactly 48 letters), the grid itself
 * (lib/games/wordhunt/generate) and the bonus words. Bad replies are retried
 * with the problems spelled out; a day that still has no theme keeps playing
 * the hand-written bank (see getDailyWordHunt).
 *
 * Not wired into a cron route here: the explain cron calls
 * ensureWordHuntPuzzles(dates).
 */
import { all, batch } from "@/lib/db";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { todayISO } from "@/lib/dates";
import { generateDailyWordHunt, type DailyWordHunt } from "@/lib/games/dailyPuzzles";
import { CELLS } from "@/lib/games/wordhunt/grid";
import { MAX_WORDS, MIN_WORDS, SPAN_LENGTH, WORD_LENGTH } from "@/lib/games/wordhunt/generate";
import { buildPuzzle } from "@/lib/games/wordhunt/server";
import type { WordHuntTheme } from "@/lib/games/wordhunt/types";
import { themeProblems } from "@/lib/games/wordhunt/validate";

const GAME = "word-hunt";
const ATTEMPTS = 4;

interface Reply {
  title?: unknown;
  span?: unknown;
  words?: unknown;
}

/** Normalize a reply into a theme, or explain why it can't be one. */
export function parseTheme(id: string, reply: Reply): { theme?: WordHuntTheme; problems: string[] } {
  const clean = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[-'’]/g, "") : "");
  const title = typeof reply.title === "string" ? reply.title.trim() : "";
  const span = clean(reply.span);
  const words = Array.isArray(reply.words) ? reply.words.map(clean) : [];
  const problems: string[] = [];
  if (!title) problems.push("missing title");
  if (!span) problems.push("missing span word");
  if (words.some((w) => /\s/.test(w))) problems.push("words must not contain spaces (write phrases as one word, e.g. icecream)");
  // The span word is listed separately; drop it if the model repeated it.
  const theme: WordHuntTheme = { id, title, span, words: words.filter((w) => w && w !== span) };
  problems.push(...themeProblems(theme));
  return problems.length ? { problems } : { theme, problems };
}

function prompt(avoid: string[], feedback: string | null): string {
  return [
    "Create one theme for a daily word puzzle played on a 6-column by 8-row grid of letters.",
    "Players find themed words by tracing paths through neighboring letters; the words fill the whole grid, so their letters must add up to exactly 48.",
    "",
    "Return JSON only, in this shape:",
    '{"title": "...", "span": "...", "words": ["...", "..."]}',
    "",
    "Rules:",
    `- "title": a short, playful clue for the theme, 2–5 words, that does not contain any of the words.`,
    `- "span": one word or a common phrase written without spaces (${SPAN_LENGTH[0]}–${SPAN_LENGTH[1]} letters) that sums up the theme, e.g. "breakfast" or "sweettooth".`,
    `- "words": ${MIN_WORDS}–${MAX_WORDS} more words that clearly belong to the theme, each ${WORD_LENGTH[0]}–${WORD_LENGTH[1]} letters, everyday English (no proper nouns, brands, abbreviations or hyphens). A common two-word phrase is fine written as one word.`,
    `- The span word plus all the words together must have exactly ${CELLS} letters. Count carefully.`,
    "- Family friendly. No repeated words.",
    avoid.length ? `- Do not reuse any of these recent themes or span words: ${avoid.join(", ")}.` : "",
    feedback ? `\nYour previous answer was rejected: ${feedback}. Fix it and answer again.` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** One AI theme turned into a playable puzzle, or null after ATTEMPTS bad replies. */
async function aiPuzzle(date: string, avoid: string[]): Promise<DailyWordHunt | null> {
  let feedback: string | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let reply: Reply;
    try {
      reply = await deepSeekJson<Reply>("word-hunt-theme", prompt(avoid, feedback), 600);
    } catch (err) {
      console.warn(`word-hunt ${date}: DeepSeek attempt ${attempt}: ${(err as Error).message}`);
      continue;
    }
    const { theme, problems } = parseTheme(date, reply);
    if (!theme) {
      const total = [reply.span, ...(Array.isArray(reply.words) ? reply.words : [])].reduce<number>((n, w) => n + (typeof w === "string" ? w.replace(/[^a-z]/gi, "").length : 0), 0);
      feedback = `${problems.join("; ")} (your words had ${total} letters in all)`;
      console.warn(`word-hunt ${date}: attempt ${attempt} rejected: ${feedback}`);
      continue;
    }
    if (avoid.includes(theme.title.toLowerCase()) || avoid.includes(theme.span)) {
      feedback = `"${theme.title}" / "${theme.span}" was used recently; pick a different theme`;
      continue;
    }
    try {
      return { date, source: "ai", puzzle: buildPuzzle(theme, `word-hunt:${date}`) };
    } catch (err) {
      feedback = `those words could not be laid out on the grid (${(err as Error).message}); try different words`;
      console.warn(`word-hunt ${date}: attempt ${attempt}: ${feedback}`);
    }
  }
  return null;
}

/**
 * Store the daily Word Hunt for each date that doesn't have one yet. Existing
 * rows are never overwritten. When DeepSeek can't produce a valid theme, a
 * future date is left empty (the next run tries again) but today or a past
 * date stores the bank puzzle people are already playing, so it never
 * changes under them. Returns what it wrote.
 */
export async function ensureWordHuntPuzzles(dates: string[]): Promise<string[]> {
  if (!dates.length) return [];
  const existing = await all<{ puzzle_date: string }>(
    `SELECT puzzle_date FROM daily_puzzles WHERE game = ? AND variant = '' AND puzzle_date IN (${dates.map(() => "?").join(", ")})`,
    GAME,
    ...dates
  );
  const have = new Set(existing.map((r) => r.puzzle_date));
  const missing = [...new Set(dates)].filter((d) => !have.has(d)).sort();
  if (!missing.length) return [];

  const recent = await all<{ data: string }>(
    "SELECT data FROM daily_puzzles WHERE game = ? ORDER BY puzzle_date DESC LIMIT 60",
    GAME
  );
  const avoid: string[] = [];
  for (const r of recent) {
    try {
      const p = (JSON.parse(r.data) as DailyWordHunt).puzzle;
      avoid.push(p.title.toLowerCase(), ...p.words.filter((w) => w.span).map((w) => w.word.toLowerCase()));
    } catch {
      // A malformed row only weakens the repeat check.
    }
  }

  const today = todayISO();
  const rows: DailyWordHunt[] = [];
  for (const date of missing) {
    const ai = hasDeepSeek() ? await aiPuzzle(date, avoid) : null;
    if (ai) {
      rows.push(ai);
      avoid.push(ai.puzzle.title.toLowerCase(), ...ai.puzzle.words.filter((w) => w.span).map((w) => w.word.toLowerCase()));
    } else if (date <= today) {
      rows.push(generateDailyWordHunt(date));
    }
  }
  if (!rows.length) return [];
  await batch(
    rows.map((r) => [
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, '', ?) ON CONFLICT DO NOTHING",
      GAME,
      r.date,
      JSON.stringify(r),
    ])
  );
  return rows.map((r) => `${GAME} ${r.date} (${r.source}: ${r.puzzle.title})`);
}
