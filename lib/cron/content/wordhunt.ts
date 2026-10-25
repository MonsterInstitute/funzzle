/**
 * Daily Word Hunt themes from DeepSeek. The model only proposes a theme: a
 * title, two or three candidate span words and a pool of 12–16 theme words.
 * Everything else is decided in code:
 *
 *   - each word is cleaned (case, spaces, hyphens) and checked on its own
 *     (dictionary or clear compound, not blocked, right length, not in the
 *     title); a bad word is dropped, not the whole reply;
 *   - code picks the span word and 5–8 theme words whose letters add up to
 *     exactly 48 (models can't count letters, so they're no longer asked to);
 *   - the grid (lib/games/wordhunt/generate) is laid out in code, trying the
 *     next-best word set when a set doesn't tile; then the bonus words.
 *
 * Bad replies are retried with the problems spelled out; a day that still has
 * no theme keeps playing the hand-written bank (see getDailyWordHunt). Every
 * rejection reason goes into the returned lines (cron_runs.detail).
 */
import { all, batch } from "@/lib/db";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { todayISO } from "@/lib/dates";
import { generateDailyWordHunt, type DailyWordHunt } from "@/lib/games/dailyPuzzles";
import { CELLS } from "@/lib/games/wordhunt/grid";
import { MAX_WORDS, MIN_WORDS, SPAN_LENGTH, WORD_LENGTH } from "@/lib/games/wordhunt/generate";
import { buildPuzzle } from "@/lib/games/wordhunt/server";
import type { WordHuntTheme } from "@/lib/games/wordhunt/types";
import { themeProblems, wordParts } from "@/lib/games/wordhunt/validate";
import { isBlocked } from "@/lib/games/words/blocklist";
import { rejectionLine } from "./rejections";

const GAME = "word-hunt";
export const ATTEMPTS = 3;
/** Word sets to try laying out per reply (each layout try is CPU-heavy when it fails). */
const LAYOUTS = 4;
const TOKENS = 1500;
const TITLE_RE = /^[A-Za-z0-9 ,'&!?:.-]+$/;

type Ask = <T>(job: string, prompt: string, maxTokens?: number) => Promise<T>;

export interface Reply {
  title?: unknown;
  span?: unknown;
  spans?: unknown;
  words?: unknown;
}

export interface Pool {
  title: string;
  /** Usable span words, best first. */
  spans: string[];
  /** Usable theme words, best first. */
  words: string[];
  /** Words that were dropped, with why. */
  dropped: string[];
  /** Reasons the reply can't be used at all (empty = usable pool). */
  problems: string[];
}

const cleanWord = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/[\s'’-]+/g, "") : "");

/** Why a word can't go on the board, or null. */
function wordProblem(w: string, title: string, [min, max]: [number, number]): string | null {
  if (!/^[a-z]+$/.test(w)) return `"${w}" has non-letters`;
  if (w.length < min || w.length > max) return `"${w}" is not ${min}–${max} letters`;
  const parts = wordParts(w);
  if (!parts) return `"${w}" is not a dictionary word`;
  if (isBlocked(w) || parts.some(isBlocked)) return `"${w}" is blocked`;
  if (title.toLowerCase().includes(w)) return `"${w}" is in the title`;
  return null;
}

/** Clean a reply into usable spans and words; each bad word is dropped on its own. */
export function parsePool(reply: Reply): Pool {
  const title = typeof reply.title === "string" ? reply.title.trim().replace(/[’‘]/g, "'").replace(/[“”"]/g, "").replace(/\s+/g, " ") : "";
  const problems: string[] = [];
  if (title.length < 3 || title.length > 40) problems.push("the title must be 3–40 characters");
  else if (!TITLE_RE.test(title)) problems.push("the title has unusual characters");
  else if (title.split(/[^A-Za-z]+/).some((t) => t && isBlocked(t))) problems.push("the title is not allowed");

  const rawSpans = [...(Array.isArray(reply.spans) ? reply.spans : []), reply.span].map(cleanWord).filter(Boolean);
  const rawWords = (Array.isArray(reply.words) ? reply.words : []).map(cleanWord).filter(Boolean);
  const dropped: string[] = [];
  const spans: string[] = [];
  for (const s of new Set(rawSpans)) {
    const why = wordProblem(s, title, SPAN_LENGTH);
    if (why) dropped.push(`span ${why}`);
    else spans.push(s);
  }
  const words: string[] = [];
  for (const w of new Set(rawWords)) {
    const why = wordProblem(w, title, WORD_LENGTH);
    if (why) dropped.push(why);
    else words.push(w);
  }
  if (!spans.length) problems.push(`no usable span word (${SPAN_LENGTH[0]}–${SPAN_LENGTH[1]} letters)${rawSpans.length ? `: ${dropped.filter((d) => d.startsWith("span")).join(", ")}` : ""}`);
  if (words.length < MIN_WORDS) problems.push(`only ${words.length} usable theme words`);
  return { title, spans, words, dropped, problems };
}

/**
 * Index sets of `lengths` (5–8 of them) that add up to `target`, earliest
 * words first (the model lists its best words first). At most `limit`.
 */
export function wordSets(lengths: number[], target: number, limit = 8): number[][] {
  const out: number[][] = [];
  const pick: number[] = [];
  const go = (from: number, left: number) => {
    if (out.length >= limit) return;
    if (left === 0 && pick.length >= MIN_WORDS) {
      out.push([...pick]);
      return;
    }
    if (left <= 0 || pick.length === MAX_WORDS) return;
    for (let i = from; i < lengths.length && out.length < limit; i++) {
      pick.push(i);
      go(i + 1, left - lengths[i]);
      pick.pop();
    }
  };
  go(0, target);
  return out;
}

/** Themes (span + words, exactly 48 letters) to try from a pool, best first. */
export function themesFrom(id: string, pool: Pool, limit = LAYOUTS): WordHuntTheme[] {
  const perSpan = pool.spans.map((span) => {
    const words = pool.words.filter((w) => w !== span);
    return wordSets(words.map((w) => w.length), CELLS - span.length, limit)
      .map((set) => ({ id, title: pool.title, span, words: set.map((i) => words[i]) }))
      .filter((t) => !themeProblems(t).length);
  });
  // Round-robin over the spans, so one span that never tiles doesn't use up every try.
  const out: WordHuntTheme[] = [];
  for (let k = 0; out.length < limit && perSpan.some((l) => l.length > k); k++) {
    for (const list of perSpan) if (list[k] && out.length < limit) out.push(list[k]);
  }
  return out;
}

export function prompt(avoid: string[], feedback: string | null): string {
  return [
    "Create one theme for a daily word puzzle played on a 6-column by 8-row grid of letters.",
    "Players find themed words by tracing paths through neighboring letters. One 'span' word stretches across the board and sums up the theme.",
    "",
    "Return JSON only, in this shape:",
    '{"title": "...", "spans": ["...", "...", "..."], "words": ["...", "...", ...]}',
    "",
    "Rules:",
    `- "title": a short, playful clue for the theme, 2–5 words, letters and spaces, that does not contain any of the words.`,
    `- "spans": 3 different candidates for the span word, best first: each one word or a common phrase written without spaces, ${SPAN_LENGTH[0]}–${SPAN_LENGTH[1]} letters, that sums up the theme (e.g. "breakfast", "sweettooth").`,
    `- "words": 14 different words that clearly belong to the theme, best first, each ${WORD_LENGTH[0]}–9 letters, with a mix of lengths (some 4–5, some 6–7, some 8–9). We pick the ones that fit the board, so you don't need to count letters.`,
    "- Every word is common, everyday English, lowercase, letters only: no proper nouns, brands, abbreviations or hyphens. A common two-word phrase is fine written as one word (icecream).",
    "- Family friendly. No word repeated, and no word inside the title.",
    avoid.length ? `- Do not reuse any of these recent themes or span words: ${avoid.join(", ")}.` : "",
    "",
    'Example (a different theme): {"title": "Rise and shine", "spans": ["breakfast", "morningmeal", "brunch"], "words": ["oatmeal", "granola", "cereal", "omelet", "pancake", "waffle", "toast", "bacon", "muffin", "yogurt", "coffee", "juice", "bagel", "sausage"]}',
    feedback ? `\nYour previous answer was rejected: ${feedback}. Fix it and answer again.` : "",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export interface WordHuntResult {
  puzzle: DailyWordHunt | null;
  reasons: string[];
  calls: number;
}

/** One AI theme turned into a playable puzzle (null after ATTEMPTS bad replies), with every rejection reason. */
export async function aiPuzzle(date: string, avoid: string[], ask: Ask = deepSeekJson): Promise<WordHuntResult> {
  let feedback: string | null = null;
  const reasons: string[] = [];
  let calls = 0;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let reply: Reply;
    calls++;
    try {
      reply = await ask<Reply>("word-hunt-theme", prompt(avoid, feedback), TOKENS);
    } catch (err) {
      reasons.push(`call ${attempt}: ${(err as Error).message}`);
      continue;
    }
    const pool = parsePool(reply);
    const recent = pool.spans.filter((s) => avoid.includes(s));
    pool.spans = pool.spans.filter((s) => !avoid.includes(s));
    if (avoid.includes(pool.title.toLowerCase())) pool.problems.push(`"${pool.title}" was used recently`);
    else if (!pool.spans.length && recent.length) pool.problems.push(`span "${recent[0]}" was used recently`);
    const themes = pool.problems.length ? [] : themesFrom(date, pool);
    if (!pool.problems.length && !themes.length) {
      const lens = pool.words.map((w) => w.length).join(",");
      pool.problems.push(`no 5–8 of the usable words (lengths ${lens}) plus a span make exactly ${CELLS} letters`);
    }
    if (pool.problems.length) {
      feedback = pool.problems.join("; ");
      reasons.push(`reply ${attempt}: ${feedback}${pool.dropped.length ? ` (dropped ${pool.dropped.slice(0, 4).join(", ")})` : ""}`);
      continue;
    }
    const layoutErrors: string[] = [];
    for (const theme of themes) {
      try {
        return { puzzle: { date, source: "ai", puzzle: buildPuzzle(theme, `word-hunt:${date}`) }, reasons, calls };
      } catch (err) {
        layoutErrors.push(`${theme.span}+${theme.words.length}: ${(err as Error).message}`);
      }
    }
    feedback = "those words could not be laid out on the grid; try a different mix of word lengths";
    reasons.push(`reply ${attempt}: no layout (${layoutErrors.slice(0, 2).join("; ")})`);
  }
  for (const r of reasons) console.warn(`word-hunt ${date}: ${r}`);
  return { puzzle: null, reasons, calls };
}

/**
 * Store the daily Word Hunt for each date that doesn't have one yet. Existing
 * rows are never overwritten. When DeepSeek can't produce a valid theme, a
 * future date is left empty (the next run tries again) but today or a past
 * date stores the bank puzzle people are already playing, so it never
 * changes under them. Returns what it wrote, plus a rejection line for each
 * date that needed retries or failed.
 */
export async function ensureWordHuntPuzzles(dates: string[], ask: Ask = deepSeekJson): Promise<string[]> {
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
  const canGenerate = ask !== deepSeekJson || hasDeepSeek();
  const rows: DailyWordHunt[] = [];
  const notes: string[] = [];
  for (const date of missing) {
    const result = canGenerate ? await aiPuzzle(date, avoid, ask) : null;
    const line = result ? rejectionLine(GAME, date, result.reasons, result.calls, Boolean(result.puzzle)) : "";
    if (line) notes.push(line);
    const ai = result?.puzzle;
    if (ai) {
      rows.push(ai);
      avoid.push(ai.puzzle.title.toLowerCase(), ...ai.puzzle.words.filter((w) => w.span).map((w) => w.word.toLowerCase()));
    } else if (date <= today) {
      rows.push(generateDailyWordHunt(date));
    }
  }
  if (rows.length) {
    await batch(
      rows.map((r) => [
        "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, '', ?) ON CONFLICT DO NOTHING",
        GAME,
        r.date,
        JSON.stringify(r),
      ])
    );
  }
  return [...rows.map((r) => `${GAME} ${r.date} (${r.source}: ${r.puzzle.title})`), ...notes];
}
