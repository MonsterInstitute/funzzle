import { all, batch } from "@/lib/db";
import { isValidISODate, shiftISODate, todayISO } from "@/lib/dates";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { generateDailyGroups, type DailyGroups } from "@/lib/games/dailyPuzzles";
import { MAX_HINT_CHARS, MAX_TITLE_CHARS, MAX_WORD_CHARS, WORD_RE, wordKey, type Group, type GroupsPuzzle, type Level } from "@/lib/games/groups";
import { puzzleErrors, wordErrors } from "@/lib/games/groups/validate";
import { isBlocked } from "@/lib/games/words/blocklist";
import { clip, rejectionLine } from "./rejections";

/**
 * Daily Groups puzzles from DeepSeek, for the explain cron. Each future date
 * without a row gets a generated puzzle:
 *
 *   1. One call asks for 4 groups (levels 1–4) with 6 candidate words each,
 *      best first. Code cleans them (spacing, ALL CAPS), drops each word that
 *      fails a check (not in the lexicon, blocked, too long, named
 *      in its own title or hint, listed in two groups) and keeps the first 4
 *      that pass; the rest are spares. One bad word no longer sinks a reply.
 *   2. puzzleErrors must then be clean, with lowercase words checked against
 *      the lexicon's "valid" tier (the bank uses "common", which lacks
 *      everyday words like "cupcake" or "sushi"; see groups/validate.ts).
 *   3. An ambiguity check: a second call names words that also fit another
 *      group, or a second valid four. Each flagged word is swapped for a spare
 *      from its own group and the board is checked again (CHECK_ROUNDS), so
 *      one loose word costs a check call, not a whole new puzzle. An
 *      unreadable check reply, or a flag that can't be fixed, rejects it.
 *
 * Up to GEN_ATTEMPTS generations per date; a date that fails is retried on
 * the next run. Every rejection reason goes into the returned lines (and so
 * into cron_runs.detail).
 *
 * A date that is already live (today or earlier) and has no row gets the
 * fallback bank puzzle the page has been showing (generateDailyGroups), so a
 * puzzle never changes while people play it.
 */

export const GEN_ATTEMPTS = 2;
export const CHECK_ROUNDS = 3;
const CANDIDATES = 6;
/** Lexicon tier for lowercase words (see lib/games/groups/validate.ts). */
const TIER = "valid";
// Generous: billing is per token actually written, and a cut-off reply is a wasted call.
const GEN_TOKENS = 3000;
const CHECK_TOKENS = 1200;

type Ask = <T>(job: string, prompt: string, maxTokens?: number) => Promise<T>;

export function generationPrompt(date: string, avoid: string[]): string {
  return `Write one original word-grouping puzzle for ${date}, for a family-friendly daily puzzle site. Players see 16 words and must sort them into 4 groups of 4 that share a hidden link.

Give 4 groups, levels 1 to 4:
- 1 = the most direct link (a plain category), 2 and 3 = need a second thought, 4 = the trickiest (wordplay is welcome: hidden words, sound-alikes, a word that goes before or after, anagrams).
- For each group give ${CANDIDATES} candidate words, best first. We use the first 4 that pass our checks; the rest are spares.

Every word must pass these checks, exactly as written:
- One common everyday English word, or a short common phrase ("hot dog"). Letters only, plus spaces, hyphens or apostrophes. At most ${MAX_WORD_CHARS} characters. No rare or technical words, slang, abbreviations, brand names, or people who are still alive.
- Lowercase, except real proper nouns, which are Capitalized ("Mars", "Paris", "New York").
- A word appears in only one group, and fits ONLY its own group's link. If it could also fit another group, leave it out.
- A word must not appear in its own group's title or hint.
- Nothing rude, scary, violent or political.

Titles: at most ${MAX_TITLE_CHARS} characters, name the link plainly ("Kinds of tree", "___ball", "Hidden body parts").
Hints: one short sentence, under 80 characters, pointing toward the link without saying the title or any of the group's words.
Original: do not copy any puzzle from a newspaper, app or website, or the example below.${avoid.length ? `\nDo not reuse these recent links: ${avoid.slice(0, 40).join("; ")}.` : ""}

Example of the format (a different puzzle):
{"groups":[
{"level":1,"title":"Kinds of pasta","hint":"Boil them, then add sauce","words":["spaghetti","macaroni","lasagna","ravioli","noodle","vermicelli"]},
{"level":2,"title":"Things with bark","hint":"Not all of them are pets","words":["dog","tree","seal","fox","birch","oak"]},
{"level":3,"title":"At a wedding","hint":"Before the honeymoon","words":["bride","veil","vow","toast","bouquet","ring"]},
{"level":4,"title":"___light","hint":"Add something that shines","words":["flash","moon","spot","sun","candle","traffic"]}]}

Return ONLY JSON in that shape.`;
}

export function ambiguityPrompt(p: GroupsPuzzle): string {
  const words = p.groups.flatMap((g) => g.words).join(", ");
  const groups = p.groups.map((g) => `${g.title}: ${g.words.join(", ")}`).join("\n");
  return `You are checking a word-grouping puzzle for fairness. The 16 words are:
${words}

The intended answer is:
${groups}

Report a problem only when a careful solver would clearly agree:
(a) a word fits another group's link just as well as its own (not a loose association), or
(b) four of the words, taken from different groups, share a different clear link, so the board could be split another way, or
(c) a link is wrong, rude or unclear.
For each problem, "words" lists only the word or words that should be replaced. Most well-made puzzles have no problems.

Return ONLY JSON: {"problems":[{"words":["..."],"why":"<one sentence>"}]}, with "problems": [] if the puzzle is fair.`;
}

const tidy = (s: unknown) => (typeof s === "string" ? s.trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ") : "");

/** Spacing and curly quotes; an ALL-CAPS word becomes lowercase (or Title Case when it's a proper noun). */
export function normalizeWord(raw: unknown): string {
  const w = tidy(raw);
  if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) {
    const lower = w.toLowerCase();
    return wordErrors(lower, TIER).length ? lower.replace(/(^|[ -])([a-z])/g, (_, sep, c) => sep + c.toUpperCase()) : lower;
  }
  return w;
}

/** Why a candidate word can't be used in its group, or null. Mirrors shapeErrors + wordErrors. */
function wordProblem(w: string, title: string, hint: string): string | null {
  if (!w) return "empty word";
  if (!WORD_RE.test(w) || w.length > MAX_WORD_CHARS || /\s{2}/.test(w)) return `"${w}": bad shape`;
  const errs = wordErrors(w, TIER);
  if (errs.length) return errs[0];
  const inText = new RegExp(`\\b${w.toLowerCase().replace(/[^a-z' -]/g, "")}\\b`, "i");
  if (inText.test(title)) return `"${w}" is in its title`;
  if (inText.test(hint)) return `"${w}" is in its hint`;
  return null;
}

export interface Candidates {
  puzzle: GroupsPuzzle;
  /** Unused valid words per group (same order as puzzle.groups), best first. */
  spares: string[][];
  /** Words dropped while picking (for the log). */
  dropped: string[];
}

/** Turn a model reply into a puzzle plus spare words; throws with the reasons when it can't. */
export function parseCandidates(raw: unknown, date: string): Candidates {
  const groups = (raw as { groups?: unknown })?.groups;
  if (!Array.isArray(groups) || groups.length !== 4) throw new Error(`reply needs 4 groups, got ${Array.isArray(groups) ? groups.length : "none"}`);
  let rows = groups.map((g: Record<string, unknown>) => ({
    level: Number(g?.level),
    title: tidy(g?.title).replace(/\.$/, ""),
    hint: tidy(g?.hint).replace(/\.$/, ""),
    words: Array.isArray(g?.words) ? g.words.map(normalizeWord).filter(Boolean) : [],
  }));
  // Levels: sort by them when they're 1–4 once each, else trust the order given.
  const levels = rows.map((r) => r.level).sort().join();
  rows = levels === "1,2,3,4" ? rows.sort((a, b) => a.level - b.level) : rows.map((r, i) => ({ ...r, level: i + 1 }));

  const groupsOf = new Map<string, Set<number>>();
  rows.forEach((r, i) => r.words.forEach((w) => groupsOf.set(wordKey(w), (groupsOf.get(wordKey(w)) ?? new Set()).add(i))));

  const errors: string[] = [];
  const dropped: string[] = [];
  const chosen: Group[] = [];
  const spares: string[][] = [];
  rows.forEach((r, i) => {
    const where = `group ${i + 1} "${r.title.slice(0, 30)}"`;
    if (!r.title || r.title.length > MAX_TITLE_CHARS) errors.push(`${where}: title must be 1–${MAX_TITLE_CHARS} chars`);
    if (!r.hint || r.hint.length > MAX_HINT_CHARS) errors.push(`${where}: hint must be 1–${MAX_HINT_CHARS} chars (${r.hint.length})`);
    for (const text of [r.title, r.hint]) for (const t of text.split(/[^A-Za-z]+/)) if (t && isBlocked(t)) errors.push(`${where}: blocked word ${t}`);
    const seen = new Set<string>();
    const ok: string[] = [];
    const lost: string[] = [];
    for (const w of r.words) {
      const k = wordKey(w);
      if (seen.has(k)) continue; // a repeat inside one group: just skip it
      seen.add(k);
      const problem = (groupsOf.get(k)?.size ?? 0) > 1 ? `"${w}" is in two groups` : wordProblem(w, r.title, r.hint);
      if (problem) lost.push(problem);
      else ok.push(w);
    }
    dropped.push(...lost);
    if (ok.length < 4) errors.push(`${where}: only ${ok.length} usable words (${lost.slice(0, 3).join(", ") || "too few given"})`);
    chosen.push({ level: (i + 1) as Level, title: r.title, hint: r.hint, words: ok.slice(0, 4) as Group["words"] });
    spares.push(ok.slice(4));
  });
  if (errors.length) throw new Error(errors.slice(0, 4).join("; "));
  const puzzle: GroupsPuzzle = { id: `ai-${date}`, groups: chosen as GroupsPuzzle["groups"] };
  // Belt and braces: the picking above should make this always pass.
  const final = puzzleErrors(puzzle, TIER);
  if (final.length) throw new Error(final.slice(0, 4).join("; "));
  return { puzzle, spares, dropped };
}

/** Back-compat for callers that only want the puzzle. */
export function parseGenerated(raw: unknown, date: string): GroupsPuzzle {
  return parseCandidates(raw, date).puzzle;
}

export interface Problem {
  words: string[];
  why: string;
}

/** Problems the ambiguity check reported; throws when the reply can't be read (fail closed). */
export function parseProblems(raw: unknown): Problem[] {
  const problems = (raw as { problems?: unknown })?.problems;
  if (!Array.isArray(problems)) throw new Error("ambiguity check reply has no problems list");
  return problems.map((p) => ({
    words: Array.isArray(p?.words) ? p.words.filter((w: unknown) => typeof w === "string") : [],
    why: typeof p?.why === "string" ? p.why : "flagged",
  }));
}

const describe = (p: Problem) => `${p.words.join(", ")}: ${p.why}`;

/**
 * Swap every flagged word for a spare from its own group. Returns the fixed
 * puzzle, or a reason it can't be fixed (a flag names no board word, or the
 * group has no spares left). Mutates `spares`.
 */
export function repair(puzzle: GroupsPuzzle, spares: string[][], problems: Problem[]): GroupsPuzzle | string {
  const groups = puzzle.groups.map((g) => ({ ...g, words: [...g.words] as Group["words"] }));
  const flagged = new Set(problems.flatMap((p) => p.words.map(wordKey)));
  const groupOf = (gs: { words: readonly string[] }[], w: string) => gs.findIndex((g) => g.words.some((x) => wordKey(x) === wordKey(w)));
  for (const p of problems) {
    // Already fixed by an earlier swap? (Several flags often name the same word.)
    if (p.words.some((w) => groupOf(puzzle.groups, w) !== -1 && groupOf(groups, w) === -1)) continue;
    let fixed = false;
    for (const w of p.words) {
      const gi = groupOf(groups, w);
      if (gi === -1) continue;
      const si = spares[gi].findIndex((s) => !flagged.has(wordKey(s)));
      if (si === -1) continue;
      const wi = groups[gi].words.findIndex((x) => wordKey(x) === wordKey(w));
      groups[gi].words[wi] = spares[gi].splice(si, 1)[0];
      fixed = true;
      break;
    }
    if (!fixed) return `unfixable flag (${clip(describe(p), 100)})`;
  }
  const next: GroupsPuzzle = { ...puzzle, groups: groups as GroupsPuzzle["groups"] };
  const errs = puzzleErrors(next, TIER);
  return errs.length ? `after swaps: ${errs[0]}` : next;
}

export interface GroupsResult {
  puzzle: GroupsPuzzle | null;
  /** Every rejection, in order: generation problems, ambiguity flags, failed repairs. */
  reasons: string[];
  calls: number;
}

/** One validated, ambiguity-checked puzzle for `date` (null after GEN_ATTEMPTS failures), with every rejection reason. */
export async function generateGroups(date: string, avoid: string[], ask: Ask = deepSeekJson): Promise<GroupsResult> {
  const seen = new Set(avoid.map((t) => t.toLowerCase()));
  const reasons: string[] = [];
  let calls = 0;
  for (let attempt = 1; attempt <= GEN_ATTEMPTS; attempt++) {
    try {
      calls++;
      const { puzzle: first, spares } = parseCandidates(await ask("content:groups", generationPrompt(date, avoid), GEN_TOKENS), date);
      const repeat = first.groups.find((g) => seen.has(g.title.toLowerCase()));
      if (repeat) throw new Error(`repeats a recent link: ${repeat.title}`);
      let puzzle = first;
      for (let round = 1; round <= CHECK_ROUNDS; round++) {
        calls++;
        const problems = parseProblems(await ask("content:groups-check", ambiguityPrompt(puzzle), CHECK_TOKENS));
        if (!problems.length) return { puzzle, reasons, calls };
        reasons.push(`check ${attempt}.${round}: ${problems.map(describe).join(" | ")}`);
        if (round === CHECK_ROUNDS) throw new Error("still flagged after the last check");
        const fixed = repair(puzzle, spares, problems);
        if (typeof fixed === "string") throw new Error(fixed);
        puzzle = fixed;
      }
    } catch (err) {
      reasons.push(`gen ${attempt}: ${(err as Error).message}`);
      console.warn(`groups ${date} attempt ${attempt}: ${(err as Error).message}`);
    }
  }
  return { puzzle: null, reasons, calls };
}

/** Links used in the last 30 days of stored Groups puzzles, to keep themes fresh. */
async function recentTitles(before: string): Promise<string[]> {
  const rows = await all<{ data: string }>(
    "SELECT data FROM daily_puzzles WHERE game = 'groups' AND variant = '' AND puzzle_date >= ? AND puzzle_date < ?",
    shiftISODate(before, -30),
    before
  );
  return rows.flatMap((r) => {
    try {
      return (JSON.parse(r.data) as DailyGroups).puzzle.groups.map((g) => g.title);
    } catch {
      return [];
    }
  });
}

/**
 * Store the Groups puzzles for `dates` that aren't stored yet (existing rows
 * are never overwritten). Returns what it wrote, e.g. ["groups 2026-10-25 (ai)"],
 * plus a rejection line for each date that needed retries or failed.
 */
export async function ensureGroupsPuzzles(dates: string[], ask: Ask = deepSeekJson): Promise<string[]> {
  const wanted = [...new Set(dates.filter(isValidISODate))].sort();
  if (!wanted.length) return [];
  const existing = await all<{ puzzle_date: string }>(
    `SELECT puzzle_date FROM daily_puzzles WHERE game = 'groups' AND variant = '' AND puzzle_date IN (${wanted.map(() => "?").join(", ")})`,
    ...wanted
  );
  const have = new Set(existing.map((r) => r.puzzle_date));
  const today = todayISO();
  const canGenerate = ask !== deepSeekJson || hasDeepSeek();
  const avoid = canGenerate ? await recentTitles(wanted[0]) : [];
  const rows: DailyGroups[] = [];
  const notes: string[] = [];
  for (const date of wanted) {
    if (have.has(date)) continue;
    if (date <= today) {
      rows.push(generateDailyGroups(date));
      continue;
    }
    if (!canGenerate) continue;
    const { puzzle, reasons, calls } = await generateGroups(date, avoid, ask);
    const line = rejectionLine("groups", date, reasons, calls, Boolean(puzzle));
    if (line) notes.push(line);
    if (!puzzle) continue;
    rows.push({ date, source: "ai", puzzle });
    avoid.push(...puzzle.groups.map((g) => g.title));
  }
  if (rows.length) {
    await batch(
      rows.map((r) => [
        "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES ('groups', ?, '', ?) ON CONFLICT DO NOTHING",
        r.date,
        JSON.stringify(r),
      ])
    );
  }
  return [...rows.map((r) => `groups ${r.date} (${r.source})`), ...notes];
}
