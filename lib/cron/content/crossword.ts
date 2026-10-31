/**
 * Daily Crossword content. For each future date (up to a week ahead) without
 * a stored row: fill the grid in code (fillDailyGrid: a seeded template, the
 * everyday-word tier, recent answers avoided), then ask DeepSeek for one
 * fair, original clue per entry in strict JSON, 40 entries per call. Every
 * clue is validated in code (clueProblems: present, sane length, no answer
 * or answer stem inside); bad or missing clues are asked for again, and a
 * date that still isn't fully clued is skipped so the next run retries it.
 * Only a puzzle that passes crosswordProblems is stored.
 *
 * Today and earlier get the fallback-bank puzzle the page is already
 * showing, so the grid never changes mid-day.
 *
 * Not wired into a cron here: the explain cron calls
 * ensureCrosswordPuzzles(crosswordDatesAhead()).
 */
import { shiftISODate, todayISO } from "@/lib/dates";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import { generateDailyCrossword, type DailyCrossword } from "@/lib/games/dailyPuzzles";
import { fillDailyGrid } from "@/lib/games/crossword/generate";
import { entriesOf, entryText, type Entry } from "@/lib/games/crossword/grid";
import { clueProblems, crosswordProblems } from "@/lib/games/crossword/puzzle";
import { rejectionLine } from "./rejections";
import { recentRows, storedDates, storeRows } from "./store";

const GAME = "crossword";
const BATCH = 40;
const ROUNDS = 3;
export const AHEAD_DAYS = 7;

/** Today through a week ahead: the dates the cron should keep stocked. */
export function crosswordDatesAhead(today = todayISO()): string[] {
  return Array.from({ length: AHEAD_DAYS + 1 }, (_, i) => shiftISODate(today, i));
}

interface Item {
  id: string;
  answer: string;
}

function cluePrompt(items: Item[], first: boolean): string {
  const list = items.map((it) => `${it.id} (${it.answer.length}): ${it.answer.toUpperCase()}`).join("\n");
  return `You write clues for a family-friendly American-style daily crossword (Monday to Wednesday difficulty). The answers are fixed; write ONE fair, original clue for each.

Rules for every clue:
- Accurate for the most common meaning of the answer; match its form (plural for plurals, past tense for past tense, -ing for -ing).
- Never use the answer itself, any word containing it, or a word sharing its stem (for STARS do not use "star"; for ELUDING do not use "elude").
- 3 to 80 characters, plain text, no trailing period, no double quotes inside (use single quotes). Fill-in-the-blank clues use ___. A clue with wordplay ends with "?".
- Nothing violent, rude, political or upsetting; no brand names of other puzzle publishers.

Answers (id (length): ANSWER):
${list}

Return ONLY JSON: {${first ? `"title": "<2-4 word title for the puzzle>", ` : ""}"clues": {"<id>": "<clue>", ...}} with exactly one clue for every id above.`;
}

/**
 * Clue every entry; returns the clue map or null when some entry still has no
 * valid clue. Call failures and leftover entries are pushed onto `log` (if given).
 */
export async function clueGrid(
  grid: string,
  entries: Entry[],
  log?: { reasons: string[]; calls: number }
): Promise<{ title: string; clues: Record<string, string> } | null> {
  const clues: Record<string, string> = {};
  let title = "";
  let todo: Item[] = entries.map((e) => ({ id: e.id, answer: entryText(grid, e) }));
  for (let round = 0; round < ROUNDS && todo.length; round++) {
    const failed: Item[] = [];
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      const first = !title && i === 0;
      let out: { title?: unknown; clues?: Record<string, unknown> } = {};
      if (log) log.calls++;
      try {
        out = await deepSeekJson<{ title?: unknown; clues?: Record<string, unknown> }>("content:crossword", cluePrompt(chunk, first), 4096);
      } catch (err) {
        console.warn(`crossword clues: ${(err as Error).message}`);
        log?.reasons.push(`round ${round + 1}: ${(err as Error).message}`);
      }
      if (first && typeof out.title === "string" && /^[A-Za-z][A-Za-z' &,-]{2,40}$/.test(out.title.trim())) title = out.title.trim();
      for (const it of chunk) {
        const raw = out.clues?.[it.id];
        const clue = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
        if (clue && !clueProblems(it.answer, clue).length) clues[it.id] = clue;
        else failed.push(it);
      }
    }
    todo = failed;
  }
  if (todo.length) {
    console.warn(`crossword clues: ${todo.length} entries without a valid clue (${todo.map((t) => t.id).join(", ")})`);
    log?.reasons.push(`${todo.length} entries still unclued after ${ROUNDS} rounds`);
    return null;
  }
  return { title: title || "Daily Crossword", clues };
}

export async function ensureCrosswordPuzzles(dates: string[]): Promise<string[]> {
  const today = todayISO();
  const limit = shiftISODate(today, AHEAD_DAYS);
  const wanted = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= limit).sort();
  const have = await storedDates(GAME, wanted);
  const written: string[] = [];
  for (const date of wanted) {
    if (have.has(date)) continue;
    if (date <= today) {
      // Keep the bank puzzle the page has shown since midnight.
      await storeRows(GAME, [{ date, data: generateDailyCrossword(date) }]);
      written.push(`${GAME} ${date} (bank)`);
      continue;
    }
    if (!hasDeepSeek()) continue;
    // Keep the last two weeks' longer answers out of the new grid.
    const recent = await recentRows<DailyCrossword>(GAME, date, 14).catch(() => []);
    const avoid = new Set<string>();
    for (const r of recent) for (const e of entriesOf(r.grid)) {
      const w = entryText(r.grid, e);
      if (w.length >= 5) avoid.add(w);
    }
    const t0 = Date.now();
    const filled = fillDailyGrid(date, avoid);
    const entries = entriesOf(filled.grid);
    const log = { reasons: [] as string[], calls: 0 };
    const clued = await clueGrid(filled.grid, entries, log);
    if (!clued) {
      written.push(rejectionLine(GAME, date, log.reasons, log.calls, false));
      continue;
    }
    const puzzle: DailyCrossword = { date, source: "llm", title: clued.title, size: filled.size, grid: filled.grid, clues: clued.clues };
    const problems = crosswordProblems(puzzle);
    if (problems.length) {
      console.warn(`crossword ${date}: ${problems.slice(0, 5).join("; ")}`);
      written.push(rejectionLine(GAME, date, problems.slice(0, 3), log.calls, false));
      continue;
    }
    // One row per date as it's ready: a later failure doesn't lose earlier days.
    await storeRows(GAME, [{ date, data: puzzle }]);
    written.push(`${GAME} ${date} (${filled.size}×${filled.size}, ${entries.length} clues, ${Date.now() - t0} ms)`);
  }
  return written;
}
