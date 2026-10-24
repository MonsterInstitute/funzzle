import { all, batch } from "@/lib/db";
import { deepSeekJson } from "@/lib/deepseek";
import { getDailySudoku } from "@/lib/games/dailyPuzzles";
import { hintLadder, type Grid } from "@/lib/games/sudoku";

/**
 * AI Coach explanations for the daily Sudoku, written ahead of time so a
 * player's "Teach me this" reads a cached row (app/api/coach) instead of
 * calling an LLM: cost per player stays at zero.
 *
 * Walks the daily grid the way a player following the coach would
 * (hintLadder → place the answer → repeat), and asks DeepSeek to turn each
 * solver step into plain language. The solver supplies every fact; DeepSeek
 * only rewords, and replies that drop the step's digit are discarded.
 * Existing rows are kept.
 */

const BATCH = 15;

interface StepText {
  key: string;
  digit: number;
  title: string;
  specific: string;
  answer: string;
}

/** The coach's steps for a player who follows every hint from the start. */
export function coachPath(puzzle: Grid, solution: Grid): StepText[] {
  const grid = puzzle.slice();
  const steps: StepText[] = [];
  for (let i = 0; i < 81; i++) {
    const ladder = hintLadder(grid, solution);
    const p = ladder?.answerPlacement;
    if (!ladder || !p) break;
    steps.push({ key: `${ladder.technique}:${p.cell}:${p.digit}`, digit: p.digit, title: ladder.title, specific: ladder.specific, answer: ladder.answer });
    grid[p.cell] = p.digit;
  }
  return steps;
}

const friendly = (t: string) => t.replace(/R(\d)C(\d)/g, "row $1, column $2");

function explain(steps: StepText[]) {
  const list = steps
    .map((s) => `${s.key}\n  technique: ${s.title}\n  why: ${friendly(s.specific)}\n  result: ${friendly(s.answer)}`)
    .join("\n");
  return deepSeekJson<Record<string, string>>(
    "coach:sudoku",
    `You are the friendly coach in Funzzle's Sudoku game. A solver has already worked out each step below; its facts are correct. For each step, write 2 or 3 short sentences that teach a casual player WHY the step works, using only the facts given. Name the technique once in plain words, mention the digit, and use 1-based rows, columns and boxes exactly as given. Never change a number or invent a fact. No emoji, no greetings.

Reply with only a JSON object mapping each step id to its explanation.

Steps:
${list}`,
    4096
  );
}

export interface CoachTextResult {
  date: string;
  steps: number;
  written: number;
  discarded: number;
}

export async function writeCoachText(date: string): Promise<CoachTextResult> {
  const { puzzle, solution } = await getDailySudoku(date);
  const steps = coachPath(puzzle, solution);
  const have = await all<{ step_key: string }>(
    "SELECT step_key FROM coach_explanations WHERE game = 'sudoku' AND puzzle_date = ?",
    date
  );
  const done = new Set(have.map((r) => r.step_key));
  const todo = steps.filter((s) => !done.has(s.key));
  let written = 0;
  let discarded = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const texts = await explain(chunk);
    const rows = chunk
      .map((s) => ({ s, text: String(texts[s.key] ?? "").trim() }))
      // Keep only replies that are about this step (mention its digit) and sane in length.
      .filter(({ s, text }) => text.length >= 40 && text.length <= 600 && text.includes(String(s.digit)));
    if (rows.length) {
      await batch(
        rows.map(({ s, text }) => [
          "INSERT INTO coach_explanations (game, puzzle_date, step_key, text) VALUES ('sudoku', ?, ?, ?) ON CONFLICT DO NOTHING",
          date,
          s.key,
          text,
        ])
      );
    }
    written += rows.length;
    discarded += chunk.length - rows.length;
  }
  return { date, steps: steps.length, written, discarded };
}
