import { all, exec } from "@/lib/db";
import { deepSeekJson, hasDeepSeek } from "@/lib/deepseek";
import type { DailyMini } from "@/lib/games/dailyPuzzles";
import { clueProblems } from "@/lib/games/mini/clues";
import { dailyGrid, wordProblems } from "@/lib/games/mini/fill";
import { layoutOf, shapeProblems, type Entry } from "@/lib/games/mini/grid";

/**
 * Daily Mini Crossword rows (game "mini-crossword" in daily_puzzles). The grid
 * is filled in code (lib/games/mini/fill.ts, a pure function of the date), so
 * every answer is a checked common word; DeepSeek only writes one clue per
 * entry. Clues are validated here (present, 3–60 chars, no answer or stem);
 * the failing ones are asked for once more, and a grid that still has a bad
 * clue is discarded, so the page falls back to the hand-clued bank. Existing
 * rows are never overwritten. Returns what it wrote.
 *
 * Not wired into a cron yet: the explain cron calls it with today/tomorrow.
 */

const GAME = "mini-crossword";

function prompt(entries: Entry[], problems?: Record<string, string>): string {
  const list = entries
    .map((e) => `${e.id} (${e.cells.length} letters): ${e.answer}${problems?.[e.id] ? `   <- previous clue rejected: ${problems[e.id]}` : ""}`)
    .join("\n");
  return `You are writing clues for a small daily crossword for casual solvers. The answers are fixed; write ONE clue for each.

${list}

Rules for every clue:
- Short and fair: 3 to 60 characters, solvable by an average adult, family-friendly.
- Original wording: do not copy clues from any published crossword.
- Never use the answer, part of it, or any form of it (plural, -ed, -ing) in the clue.
- Match the answer's part of speech and tense; use "___" for a fill-in-the-blank.
- No trivia that needs a specific proper noun to solve.

Return ONLY JSON with one key per entry id, e.g. {"1A": "Clue", "1D": "Clue"}.`;
}

/** Validated clues for every entry, or null after one retry for the failures. */
export async function clueGrid(rows: string[], ask = deepSeekJson): Promise<Record<string, string> | null> {
  const { entries } = layoutOf(rows);
  const clues: Record<string, string> = {};
  let todo = entries;
  let problems: Record<string, string> | undefined;
  for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
    let reply: Record<string, unknown>;
    try {
      reply = await ask<Record<string, unknown>>(`clues:${GAME}`, prompt(todo, problems), 1024);
    } catch (err) {
      console.warn(`mini clues: ${(err as Error).message}`);
      reply = {};
    }
    problems = {};
    for (const e of todo) {
      const raw = reply[e.id];
      const issues = clueProblems(e.answer, raw);
      if (issues.length) problems[e.id] = issues.join(", ");
      else clues[e.id] = (raw as string).trim();
    }
    todo = todo.filter((e) => problems![e.id]);
  }
  return todo.length ? null : clues;
}

export async function ensureMiniPuzzles(dates: string[]): Promise<string[]> {
  if (!dates.length || !hasDeepSeek()) return [];
  const existing = await all<{ puzzle_date: string }>(
    `SELECT puzzle_date FROM daily_puzzles WHERE game = ? AND variant = '' AND puzzle_date IN (${dates.map(() => "?").join(", ")})`,
    GAME,
    ...dates
  );
  const have = new Set(existing.map((r) => r.puzzle_date));
  const written: string[] = [];
  for (const date of dates) {
    if (have.has(date)) continue;
    const grid = dailyGrid(date);
    // The fill already guarantees these; re-check before anything is stored.
    const bad = [...shapeProblems(grid.rows), ...wordProblems(grid)];
    if (bad.length) {
      console.warn(`mini ${date}: grid rejected: ${bad.join("; ")}`);
      continue;
    }
    const clues = await clueGrid(grid.rows);
    if (!clues) {
      console.warn(`mini ${date}: clues failed validation twice; the bank puzzle stays`);
      continue;
    }
    const row: DailyMini = { date, size: grid.size, rows: grid.rows, clues, source: "generated" };
    const changed = await exec(
      "INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES (?, ?, '', ?) ON CONFLICT DO NOTHING",
      GAME,
      date,
      JSON.stringify(row)
    );
    if (changed) written.push(`${GAME} ${date}`);
  }
  return written;
}
