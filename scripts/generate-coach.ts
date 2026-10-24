/**
 * AI Coach explanations for the daily Sudoku, written ahead of time so a
 * player's "Teach me this" reads a cached row (app/api/coach) instead of
 * calling an LLM: cost per player stays at zero.
 *
 * For today and tomorrow (UTC) it walks the daily grid the way a player
 * following the coach would (hintLadder → place the answer → repeat), and asks
 * DeepSeek to turn each solver step into plain language. The solver supplies
 * every fact; DeepSeek only rewords, and replies that drop the step's digit
 * are discarded. Existing rows are kept.
 *
 * Also stores the day's puzzle in daily_puzzles if the answers cron hasn't yet.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, DEEPSEEK_API_KEY
 * (optional DEEPSEEK_MODEL). Run: see the Daily Content workflow (bundled
 * with esbuild, which resolves the "@/" paths from tsconfig.json).
 */
import { createClient } from "@supabase/supabase-js";
import { generateSudoku, hintLadder, type Grid } from "@/lib/games/sudoku";
import { sudokuDifficultyFor } from "@/lib/games/dailySchedule";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const BATCH = 15;

if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE are required");
if (!DEEPSEEK_API_KEY) {
  console.log("No DEEPSEEK_API_KEY: skipping coach explanations.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
});

interface StepText {
  key: string;
  digit: number;
  title: string;
  specific: string;
  answer: string;
}

async function dailySudoku(date: string): Promise<{ puzzle: Grid; solution: Grid }> {
  const { data, error } = await supabase
    .from("daily_puzzles")
    .select("data")
    .eq("game", "sudoku")
    .eq("puzzle_date", date)
    .eq("variant", "")
    .maybeSingle();
  if (error) throw new Error(`daily_puzzles read: ${error.message}`);
  if (data) return data.data as { puzzle: Grid; solution: Grid };
  const difficulty = sudokuDifficultyFor(date);
  const p = generateSudoku(`sudoku:${date}`, difficulty);
  const row = { date, difficulty: p.difficulty, puzzle: p.puzzle, solution: p.solution };
  const { error: insErr } = await supabase
    .from("daily_puzzles")
    .upsert({ game: "sudoku", puzzle_date: date, variant: "", data: row }, { onConflict: "game,puzzle_date,variant", ignoreDuplicates: true });
  if (insErr) throw new Error(`daily_puzzles insert: ${insErr.message}`);
  console.log(`Stored daily sudoku for ${date}`);
  return row;
}

/** The coach's steps for a player who follows every hint from the start. */
function coachPath(puzzle: Grid, solution: Grid): StepText[] {
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

async function explain(steps: StepText[]): Promise<Record<string, string>> {
  const list = steps
    .map((s) => `${s.key}\n  technique: ${s.title}\n  why: ${friendly(s.specific)}\n  result: ${friendly(s.answer)}`)
    .join("\n");
  const prompt = `You are the friendly coach in Funzzle's Sudoku game. A solver has already worked out each step below; its facts are correct. For each step, write 2 or 3 short sentences that teach a casual player WHY the step works, using only the facts given. Name the technique once in plain words, mention the digit, and use 1-based rows, columns and boxes exactly as given. Never change a number or invent a fact. No emoji, no greetings.

Reply with only a JSON object mapping each step id to its explanation.

Steps:
${list}`;
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
}

async function run(date: string) {
  const { puzzle, solution } = await dailySudoku(date);
  const steps = coachPath(puzzle, solution);
  const { data: have, error } = await supabase.from("coach_explanations").select("step_key").eq("game", "sudoku").eq("puzzle_date", date);
  if (error) throw new Error(`coach_explanations read: ${error.message}`);
  const done = new Set((have ?? []).map((r) => r.step_key));
  const todo = steps.filter((s) => !done.has(s.key));
  console.log(`${date}: ${steps.length} coach steps, ${todo.length} to explain`);
  let written = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = await explain(batch);
    const rows = batch
      .map((s) => ({ s, text: String(texts[s.key] ?? "").trim() }))
      // Keep only replies that are about this step (mention its digit) and sane in length.
      .filter(({ s, text }) => text.length >= 40 && text.length <= 600 && text.includes(String(s.digit)))
      .map(({ s, text }) => ({ game: "sudoku", puzzle_date: date, step_key: s.key, text }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("coach_explanations").upsert(rows, { onConflict: "game,puzzle_date,step_key", ignoreDuplicates: true });
      if (insErr) throw new Error(`coach_explanations insert: ${insErr.message}`);
    }
    written += rows.length;
    if (rows.length < batch.length) console.warn(`${date}: discarded ${batch.length - rows.length} explanation(s) that failed checks`);
  }
  console.log(`${date}: wrote ${written} explanations`);
}

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
for (const date of [today, tomorrow]) await run(date);
