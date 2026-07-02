/**
 * Daily content generator — REAL answers edition.
 *
 * For today's date it:
 *   1. Fetches the REAL Wordle answer from NYT's free public endpoint.
 *   2. Fetches the REAL NYT Mini crossword (clues + answers) from NYT's
 *      official puzzle endpoint (requires a NYT-S cookie; see
 *      scripts/fetch-nyt-mini.mjs). If unavailable, the Mini is skipped for
 *      the day rather than fabricated.
 *   3. Uses the Claude API ONLY to write human explanations / analysis of the
 *      real answers — never to invent the answers themselves. If no
 *      ANTHROPIC_API_KEY is set, real answers are still stored (without the
 *      extra prose).
 *   4. Upserts the rows into Supabase, REPLACING any previously stored
 *      (possibly fake / AI-generated) rows for the same date+type.
 *   5. Triggers a Vercel redeploy via the deploy hook so static pages rebuild.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE
 * Real Mini:    NYT_S (or NYT_COOKIE)   — free nytimes.com account cookie
 * Explanations: ANTHROPIC_API_KEY       — optional but recommended
 * Optional:     VERCEL_DEPLOY_HOOK_URL, ANTHROPIC_MODEL
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { fetchNytMini } from "./fetch-nyt-mini.mjs";
import { fetchWordle } from "./fetch-wordle.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

/** Today's calendar day in UTC (YYYY-MM-DD). */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function extractJson(text) {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function askClaudeJson(prompt) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return extractJson(text);
}

/**
 * Ask Claude to explain the REAL mini answers. Returns { summary, clues }
 * where clues maps "<number><A|D>" -> explanation string. Answers are given
 * to the model as fixed facts; it only writes prose about them.
 */
async function explainMini(puzzle) {
  if (!anthropic) return { summary: null, clues: {} };
  const list = (arr, dir) =>
    arr
      .map((c) => `${c.number}${dir}. ${c.clue} => ${c.answer}`)
      .join("\n");
  const prompt = `These are the REAL, already-solved answers to today's NYT Mini crossword. Do NOT change any answer. Write short explanations of why each answer fits its clue.

ACROSS
${list(puzzle.across, "A")}
DOWN
${list(puzzle.down, "D")}

Return ONLY JSON (no markdown, no fences):
{
  "summary": "<one or two sentences summarizing today's mini and any theme>",
  "clues": {
    "1A": "<one concise sentence explaining why the answer fits the clue>",
    "2D": "..."
  }
}
Include one entry in "clues" for every clue above, keyed by number + A (across) or D (down). Keep each explanation factual and under 20 words.`;
  try {
    const out = await askClaudeJson(prompt);
    return { summary: out?.summary ?? null, clues: out?.clues ?? {} };
  } catch (err) {
    console.warn(`⚠️  Mini explanations skipped: ${err.message}`);
    return { summary: null, clues: {} };
  }
}

/** Ask Claude for a one-sentence summary of the REAL Wordle answer. */
async function explainWordle(answer) {
  if (!anthropic) return null;
  const prompt = `Today's real Wordle answer is "${answer}". Do NOT change it. Return ONLY JSON (no markdown):
{"summary": "<one factual sentence about the word ${answer} — its meaning and what makes it easy or tricky to guess>"}`;
  try {
    const out = await askClaudeJson(prompt);
    return typeof out?.summary === "string" ? out.summary : null;
  } catch (err) {
    console.warn(`⚠️  Wordle summary skipped: ${err.message}`);
    return null;
  }
}

/** Delete any existing row for (date,type) then insert the fresh one. */
async function upsertAnswer(row) {
  const { error: delErr } = await supabase
    .from("answers")
    .delete()
    .eq("publish_date", row.publish_date)
    .eq("type", row.type);
  if (delErr) throw new Error(`delete ${row.type} failed: ${delErr.message}`);
  const { error: insErr } = await supabase.from("answers").insert(row);
  if (insErr) throw new Error(`insert ${row.type} failed: ${insErr.message}`);
}

async function buildWordleRow(date) {
  const wordle = await fetchWordle(date);
  const summary = await explainWordle(wordle.answer_data.answer);
  return {
    publish_date: date,
    type: "wordle",
    answer_data: wordle.answer_data,
    summary,
  };
}

async function buildMiniRow(date) {
  const puzzle = await fetchNytMini(date);
  const { summary, clues } = await explainMini(puzzle);
  const withExplanations = (arr, dir) =>
    arr.map((c) => ({
      number: c.number,
      clue: c.clue,
      answer: c.answer,
      explanation: clues[`${c.number}${dir}`] ?? undefined,
    }));
  return {
    publish_date: date,
    type: "nyt-mini",
    answer_data: {
      across: withExplanations(puzzle.across, "A"),
      down: withExplanations(puzzle.down, "D"),
    },
    summary,
  };
}

async function main() {
  const date = todayISO();
  console.log(`Generating REAL content for ${date} (explanations via ${MODEL})`);
  if (!anthropic) {
    console.warn(
      "⚠️  ANTHROPIC_API_KEY not set — storing real answers without explanations."
    );
  }

  let wrote = 0;
  const failures = [];

  // Wordle — free, always available.
  try {
    const row = await buildWordleRow(date);
    await upsertAnswer(row);
    console.log(`✅ Wordle: ${row.answer_data.answer}`);
    wrote++;
  } catch (err) {
    console.error(`❌ Wordle failed: ${err.message}`);
    failures.push("wordle");
  }

  // NYT Mini — needs the NYT-S cookie.
  try {
    const row = await buildMiniRow(date);
    const a = row.answer_data.across.map((c) => c.answer).join(", ");
    console.log(`✅ NYT Mini across: ${a}`);
    await upsertAnswer(row);
    wrote++;
  } catch (err) {
    console.error(`❌ NYT Mini failed: ${err.message}`);
    failures.push("nyt-mini");
  }

  if (wrote === 0) {
    throw new Error(`nothing written (failed: ${failures.join(", ")})`);
  }
  console.log(`Wrote ${wrote} answer row(s) for ${date}.`);

  if (DEPLOY_HOOK) {
    const res = await fetch(DEPLOY_HOOK, { method: "POST" });
    console.log(`Deploy hook triggered: ${res.status}`);
  } else {
    console.log("No VERCEL_DEPLOY_HOOK_URL set — skipping redeploy.");
  }

  // Surface partial failure to CI without discarding the rows we did write.
  if (failures.length) {
    console.warn(`⚠️  Completed with partial failures: ${failures.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("❌ generate-daily-content failed:", err.message);
  process.exit(1);
});
