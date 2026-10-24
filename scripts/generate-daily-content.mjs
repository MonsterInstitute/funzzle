/**
 * Daily content generator — REAL answers from PUBLIC sources.
 *
 * For today AND tomorrow (UTC) it, for each of the three highest-traffic games
 * (Wordle, Connections, NYT Mini), unless that row already has explanations:
 *   1. Fetches the REAL answer from public sources (see fetch-public-answers.mjs)
 *      — NYT's own free JSON for Wordle/Connections, public answer pages for the
 *      Mini. Never fabricates: an un-fetchable game is a failure, not a guess.
 *   2. Uses the DeepSeek API ONLY to write human explanations / analysis around the
 *      REAL answers — never to invent them. Explanations are optional (skipped if
 *      no DEEPSEEK_API_KEY); the real answers are always stored.
 *   3. Upserts the row into Supabase, REPLACING any previously stored row for the
 *      same (date, type). Successful games are always written, even if others fail.
 *   4. If it wrote any of TODAY's rows, refreshes today's pages through the
 *      site's on-demand revalidation route (scripts/revalidate-site.mjs). If
 *      that fails the run fails (red); pages still roll over at the next
 *      midnight-UTC revalidation.
 *      Tomorrow's rows stay hidden until the 00:01 UTC revalidation.
 *
 * Timing: this job adds explanations; it is NOT what gets answers live on time.
 * GitHub's schedule runs hours late, so the site's answers cron
 * (app/api/cron/answers, a Cloudflare Cron Trigger) stores the bare answers on the minute and
 * this job replaces those rows with explained copies whenever it runs.
 *
 * FAILS LOUDLY: if any game fails to fetch+write, the process exits non-zero
 * AFTER writing the ones that succeeded — so a broken source turns the CI run
 * red instead of passing as a silent partial success. The one expected gap is
 * tomorrow's Mini, which NYT releases only at 22:00 ET (18:00 ET weekends).
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE
 * Explanations: DEEPSEEK_API_KEY  (optional but recommended)
 * Revalidation: REVALIDATE_SECRET, SITE_URL (default https://www.funzzle.com)
 * Optional:     DEEPSEEK_MODEL
 */
import { createClient } from "@supabase/supabase-js";
import { fetchWordle, fetchConnections, fetchMini } from "./fetch-public-answers.mjs";
import { revalidateSite } from "./revalidate-site.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
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

function tomorrowISO() {
  const d = new Date(`${todayISO()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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

/**
 * Replace the row for (date,type). With the unique index on
 * answers(publish_date, type) this is one atomic upsert; without it (Postgres
 * 42P10: no matching constraint) it falls back to delete + insert.
 */
export async function upsertAnswer(row) {
  const { error } = await supabase.from("answers").upsert(row, { onConflict: "publish_date,type" });
  if (!error) return;
  if (error.code !== "42P10") throw new Error(`upsert ${row.type} failed: ${error.message}`);

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

/** (date|type) keys of rows that already carry explanations, for `dates`. */
async function explainedRows(dates) {
  const { data, error } = await supabase
    .from("answers")
    .select("publish_date, type, summary")
    .in("publish_date", dates);
  if (error) throw new Error(`reading existing rows failed: ${error.message}`);
  return new Set(data.filter((r) => r.summary).map((r) => `${r.publish_date}|${r.type}`));
}

async function main() {
  const today = todayISO();
  const tomorrow = tomorrowISO();
  const dates = [today, tomorrow];
  console.log(`Generating REAL content for ${dates.join(" + ")} (explanations via ${MODEL})`);
  if (!deepseek) {
    console.warn("⚠️  DEEPSEEK_API_KEY not set — storing real answers without explanations.");
  }

  const done = await explainedRows(dates);
  const wroteDates = new Set();
  const failures = [];

  for (const date of dates) {
    for (const game of GAMES) {
      if (done.has(`${date}|${game.key}`)) {
        console.log(`·  ${date} ${game.label}: already has explanations — skipped`);
        continue;
      }
      try {
        const { row, source } = await game.build(date);
        await upsertAnswer(row);
        console.log(`✅ ${date} ${game.label} [${source}]: ${previewRow(game.key, row)}`);
        wroteDates.add(date);
      } catch (err) {
        if (date === tomorrow && game.key === "nyt-mini") {
          console.log(`·  ${date} ${game.label}: not available yet (${err.message})`);
          continue;
        }
        console.error(`❌ ${date} ${game.label} failed: ${err.message}`);
        failures.push(`${date} ${game.key}`);
      }
    }
  }

  // Pages are cached until revalidated: refresh today's pages on demand when
  // today's rows changed. A failed refresh fails the run: the answers are
  // stored, but today's pages can show stale content until the next
  // midnight-UTC revalidation.
  if (wroteDates.has(today) && !(await revalidateSite([today]))) {
    failures.push("revalidation");
  }

  // Fail loudly so a broken source turns the CI run RED (no silent green).
  if (failures.length) {
    throw new Error(`${failures.length} answer(s) failed: ${failures.join(", ")}`);
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
