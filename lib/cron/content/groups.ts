import { all, batch } from "@/lib/db";
import { isValidISODate, shiftISODate, todayISO } from "@/lib/dates";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { generateDailyGroups, type DailyGroups } from "@/lib/games/dailyPuzzles";
import type { Group, GroupsPuzzle } from "@/lib/games/groups";
import { puzzleErrors } from "@/lib/games/groups/validate";

/**
 * Daily Groups puzzles from DeepSeek, for the explain cron (the lead wires
 * the call). Each future date without a row gets a generated puzzle that
 * must pass, in code:
 *   - puzzleErrors: 4 groups at levels 1–4, 16 distinct words of ≤ 14
 *     chars, everyday words in the lexicon's common tier (capitalized proper
 *     nouns allowed), nothing blocked, titles ≤ 40 chars, hints that don't
 *     give a word away;
 *   - an ambiguity check: a second call asks the model to break the puzzle
 *     (another valid four, or a word that fits a second group). Anything
 *     found, or an unreadable reply, rejects the puzzle.
 * Up to ATTEMPTS tries per date; a date that fails is retried on the next run.
 *
 * A date that is already live (today or earlier) and has no row gets the
 * fallback bank puzzle the page has been showing (generateDailyGroups), so a
 * puzzle never changes while people play it.
 */

export const ATTEMPTS = 3;
const GEN_TOKENS = 1500;
const CHECK_TOKENS = 700;

type Ask = <T>(job: string, prompt: string, maxTokens?: number) => Promise<T>;

export function generationPrompt(date: string, avoid: string[]): string {
  return `Write one original word-grouping puzzle for ${date}, for a family-friendly daily puzzle site.

Rules:
- 16 different words or short names, in exactly 4 groups of 4. Each group shares a hidden link.
- Levels: 1 = the most direct link (a plain category), 2 and 3 = need a second thought, 4 = the trickiest (wordplay is welcome: hidden words, sound-alikes, a missing word before or after, anagrams).
- Each word: at most 14 characters, letters only (spaces or hyphens allowed in a short phrase). Everyday English words in lowercase; capitalize only real proper nouns (e.g. "Mars", "Paris"). No brand names, no people who are still alive, nothing rude, scary or political.
- Fair and unambiguous: every word must fit ONLY its own group. If a word could also fit another group's link, replace it.
- Titles: at most 40 characters, describe the link plainly (e.g. "Kinds of tree", "___ball").
- Hint: one short sentence (under 80 characters) that points toward the link without saying the title or any of the group's words.
- Original: do not copy any puzzle from a newspaper, app or website.${avoid.length ? `\n- Avoid these recent links: ${avoid.slice(0, 40).join("; ")}.` : ""}

Return ONLY JSON:
{"groups":[{"level":1,"title":"...","hint":"...","words":["...","...","...","..."]},{"level":2,...},{"level":3,...},{"level":4,...}]}`;
}

export function ambiguityPrompt(p: GroupsPuzzle): string {
  const words = p.groups.flatMap((g) => g.words).join(", ");
  const groups = p.groups.map((g) => `${g.title}: ${g.words.join(", ")}`).join("\n");
  return `You are testing a word-grouping puzzle for fairness. The 16 words are:
${words}

The intended answer is:
${groups}

Try hard to break it. Report a problem if (a) any word also fits another group's link about as well as its own, or (b) there is a different set of four words that shares a clear link a fair solver would accept, so the board could be split another way, or (c) a link is wrong, rude or unclear.

Return ONLY JSON: {"problems":[{"words":["..."],"why":"<one sentence>"}]}  with "problems": [] if the puzzle is fair.`;
}

/** Turn a model reply into a puzzle; throws with the reasons when it isn't valid. */
export function parseGenerated(raw: unknown, date: string): GroupsPuzzle {
  const groups = (raw as { groups?: unknown })?.groups;
  if (!Array.isArray(groups) || groups.length !== 4) throw new Error("reply needs 4 groups");
  const clean = groups
    .map((g: Record<string, unknown>) => ({
      level: Number(g?.level),
      title: typeof g?.title === "string" ? g.title.trim().replace(/\s+/g, " ") : "",
      hint: typeof g?.hint === "string" ? g.hint.trim().replace(/\s+/g, " ").replace(/\.$/, "") : "",
      words: Array.isArray(g?.words) ? g.words.map((w: unknown) => (typeof w === "string" ? w.trim().replace(/\s+/g, " ") : "")) : [],
    }))
    .sort((a, b) => a.level - b.level) as Group[];
  const puzzle: GroupsPuzzle = { id: `ai-${date}`, groups: clean as GroupsPuzzle["groups"] };
  const errors = puzzleErrors(puzzle);
  if (errors.length) throw new Error(errors.slice(0, 5).join("; "));
  return puzzle;
}

/** Problems the ambiguity check reported; throws when the reply can't be read (fail closed). */
export function parseProblems(raw: unknown): string[] {
  const problems = (raw as { problems?: unknown })?.problems;
  if (!Array.isArray(problems)) throw new Error("ambiguity check reply has no problems list");
  return problems.map((p) => {
    const words = Array.isArray(p?.words) ? p.words.filter((w: unknown) => typeof w === "string").join(", ") : "";
    return `${words}: ${typeof p?.why === "string" ? p.why : "flagged"}`.slice(0, 200);
  });
}

/** One validated, ambiguity-checked puzzle for `date`, or null after ATTEMPTS failures. */
export async function generateGroups(date: string, avoid: string[], ask: Ask = deepSeekJson): Promise<GroupsPuzzle | null> {
  const seen = new Set(avoid.map((t) => t.toLowerCase()));
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const puzzle = parseGenerated(await ask("content:groups", generationPrompt(date, avoid), GEN_TOKENS), date);
      const repeat = puzzle.groups.find((g) => seen.has(g.title.toLowerCase()));
      if (repeat) throw new Error(`repeats a recent link: ${repeat.title}`);
      const problems = parseProblems(await ask("content:groups-check", ambiguityPrompt(puzzle), CHECK_TOKENS));
      if (problems.length) throw new Error(`ambiguous: ${problems.join(" | ")}`);
      return puzzle;
    } catch (err) {
      console.warn(`groups ${date} attempt ${attempt}: ${(err as Error).message}`);
    }
  }
  return null;
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
 * are never overwritten). Returns what it wrote, e.g. ["groups 2026-10-25 (ai)"].
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
  for (const date of wanted) {
    if (have.has(date)) continue;
    if (date <= today) {
      rows.push(generateDailyGroups(date));
      continue;
    }
    if (!canGenerate) continue;
    const puzzle = await generateGroups(date, avoid, ask);
    if (!puzzle) continue;
    rows.push({ date, source: "ai", puzzle });
    avoid.push(...puzzle.groups.map((g) => g.title));
  }
  if (!rows.length) return [];
  await batch(
    rows.map((r) => [
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES ('groups', ?, '', ?) ON CONFLICT DO NOTHING",
      r.date,
      JSON.stringify(r),
    ])
  );
  return rows.map((r) => `groups ${r.date} (${r.source})`);
}
