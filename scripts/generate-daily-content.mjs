/**
 * Daily content generator — REAL answers from PUBLIC sources.
 *
 * For today's date it, for each of the three highest-traffic games
 * (Wordle, Connections, NYT Mini):
 *   1. Fetches the REAL answer from public sources (see fetch-public-answers.mjs)
 *      — NYT's own free JSON for Wordle/Connections, public answer pages for the
 *      Mini. Never fabricates: an un-fetchable game is a failure, not a guess.
 *   2. Uses the DeepSeek API ONLY to write human explanations / analysis around the
 *      REAL answers — never to invent them. Explanations are optional (skipped if
 *      no DEEPSEEK_API_KEY); the real answers are always stored.
 *   3. Upserts the row into Supabase, REPLACING any previously stored row for the
 *      same (date, type). Successful games are always written, even if others fail.
 *   4. Triggers a Vercel redeploy via the deploy hook so static pages rebuild.
 *
 * FAILS LOUDLY: if ANY of the three games fails to fetch+write, the process exits
 * non-zero AFTER writing the ones that succeeded — so a broken source turns the CI
 * run red instead of passing as a silent partial success.
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE
 * Explanations: DEEPSEEK_API_KEY  (optional but recommended)
 * Optional:     VERCEL_DEPLOY_HOOK_URL, DEEPSEEK_MODEL
 */
import { createClient } from "@supabase/supabase-js";
import { fetchWordle, fetchConnections, fetchMini } from "./fetch-public-answers.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL;
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const deepseek = DEEPSEEK_API_KEY ? true : false;

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

async function askDeepSeekJson(prompt) {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  return extractJson(text);
}

// ---------------------------------------------------------------------------
// Explanations (DeepSeek writes prose about the REAL answers; never invents them)
// ---------------------------------------------------------------------------

async function explainMini(puzzle) {
  if (!deepseek) return { summary: null, clues: {} };
  const list = (arr, dir) =>
    arr.map((c) => `${c.number}${dir}. ${c.clue} => ${c.answer}`).join("\n");
  const prompt = `These are the REAL, already-solved answers to today's NYT Mini crossword. Do NOT change any answer. Write short explanations of why each answer fits its clue.

ACROSS
${list(puzzle.across, "A")}
DOWN
${list(puzzle.down, "D")}

Return ONLY JSON (no markdown, no fences):
{
  "summary": "<one or two sentences summarizing today's mini and any theme>",
  "clues": { "1A": "<one concise sentence>", "2D": "..." }
}
Include one entry in "clues" for every clue above, keyed by number + A (across) or D (down). Keep each explanation factual and under 20 words.`;
  try {
    const out = await askDeepSeekJson(prompt);
    return { summary: out?.summary ?? null, clues: out?.clues ?? {} };
  } catch (err) {
    console.warn(`⚠️  Mini explanations skipped: ${err.message}`);
    return { summary: null, clues: {} };
  }
}

async function explainWordle(answer) {
  if (!deepseek) return null;
  const prompt = `Today's real Wordle answer is "${answer}". Do NOT change it. Return ONLY JSON (no markdown):
{"summary": "<one factual sentence about the word ${answer} — its meaning and what makes it easy or tricky to guess>"}`;
  try {
    const out = await askDeepSeekJson(prompt);
    return typeof out?.summary === "string" ? out.summary : null;
  } catch (err) {
    console.warn(`⚠️  Wordle summary skipped: ${err.message}`);
    return null;
  }
}

async function explainConnections(groups) {
  if (!deepseek) return { summary: null, notes: {} };
  const list = groups
    .map((g) => `${g.color} — ${g.title}: ${g.words.join(", ")}`)
    .join("\n");
  const prompt = `These are today's REAL NYT Connections groups (already solved). Do NOT change any word or group. Write a short factual note for each group explaining the connection, plus a one-sentence overall summary.

${list}

Return ONLY JSON (no markdown):
{"summary":"<one sentence>","notes":{"${groups[0].title}":"<one concise sentence, under 22 words>"}}
Include one entry in "notes" for every group title above.`;
  try {
    const out = await askDeepSeekJson(prompt);
    return { summary: out?.summary ?? null, notes: out?.notes ?? {} };
  } catch (err) {
    console.warn(`⚠️  Connections explanations skipped: ${err.message}`);
    return { summary: null, notes: {} };
  }
}

// ---------------------------------------------------------------------------
// Row builders (fetch REAL data -> attach explanations -> DB row shape)
// ---------------------------------------------------------------------------

export async function buildWordleRow(date) {
  const { answer_data, source } = await fetchWordle(date);
  const summary = await explainWordle(answer_data.answer);
  return { row: { publish_date: date, type: "wordle", answer_data, summary }, source };
}

export async function buildMiniRow(date) {
  const { answer_data, source } = await fetchMini(date);
  const { summary, clues } = await explainMini(answer_data);
  const withExplanations = (arr, dir) =>
    arr.map((c) => ({
      number: c.number,
      clue: c.clue,
      answer: c.answer,
      explanation: clues[`${c.number}${dir}`] ?? undefined,
    }));
  return {
    row: {
      publish_date: date,
      type: "nyt-mini",
      answer_data: {
        across: withExplanations(answer_data.across, "A"),
        down: withExplanations(answer_data.down, "D"),
      },
      summary,
    },
    source,
  };
}

export async function buildConnectionsRow(date) {
  const { answer_data, source } = await fetchConnections(date);
  const { summary, notes } = await explainConnections(answer_data.groups);
  const groups = answer_data.groups.map((g) => ({
    ...g,
    note: notes[g.title] ?? undefined,
  }));
  return {
    row: {
      publish_date: date,
      type: "connections",
      answer_data: { groups, editor: answer_data.editor ?? null },
      summary,
    },
    source,
  };
}

/** The three games this pipeline covers, in write order. */
export const GAMES = [
  { key: "wordle", label: "Wordle", build: buildWordleRow },
  { key: "connections", label: "Connections", build: buildConnectionsRow },
  { key: "nyt-mini", label: "NYT Mini", build: buildMiniRow },
];

/** Delete any existing row for (date,type) then insert the fresh one. */
export async function upsertAnswer(row) {
  const { error: delErr } = await supabase
    .from("answers")
    .delete()
    .eq("publish_date", row.publish_date)
    .eq("type", row.type);
  if (delErr) throw new Error(`delete ${row.type} failed: ${delErr.message}`);
  const { error: insErr } = await supabase.from("answers").insert(row);
  if (insErr) throw new Error(`insert ${row.type} failed: ${insErr.message}`);
}

/** One-line human-readable preview of a written row, for logs. */
function previewRow(key, row) {
  if (key === "wordle") return row.answer_data.answer;
  if (key === "nyt-mini")
    return row.answer_data.across.map((c) => c.answer).join(", ");
  if (key === "connections")
    return row.answer_data.groups.map((g) => g.title).join(" | ");
  return "";
}

async function main() {
  const date = todayISO();
  console.log(`Generating REAL content for ${date} (explanations via ${MODEL})`);
  if (!deepseek) {
    console.warn("⚠️  DEEPSEEK_API_KEY not set — storing real answers without explanations.");
  }

  let wrote = 0;
  const failures = [];

  for (const game of GAMES) {
    try {
      const { row, source } = await game.build(date);
      await upsertAnswer(row);
      console.log(`✅ ${game.label} [${source}]: ${previewRow(game.key, row)}`);
      wrote++;
    } catch (err) {
      console.error(`❌ ${game.label} failed: ${err.message}`);
      failures.push(game.key);
    }
  }

  console.log(`Wrote ${wrote}/${GAMES.length} answer row(s) for ${date}.`);

  if (DEPLOY_HOOK && wrote > 0) {
    const res = await fetch(DEPLOY_HOOK, { method: "POST" });
    console.log(`Deploy hook triggered: ${res.status}`);
  } else if (!DEPLOY_HOOK) {
    console.log("No VERCEL_DEPLOY_HOOK_URL set — skipping redeploy.");
  }

  // Fail loudly so a broken source turns the CI run RED (no silent green).
  if (failures.length) {
    throw new Error(
      `${failures.length} of ${GAMES.length} games failed: ${failures.join(", ")}`
    );
  }
}

// Only run the daily job when invoked directly as a CLI, so other scripts
// (e.g. the backfill) can import the builders without triggering a full run.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("❌ generate-daily-content failed:", err.message);
    process.exit(1);
  });
}
