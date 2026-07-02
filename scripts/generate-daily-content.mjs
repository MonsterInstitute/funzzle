/**
 * Daily content generator.
 * Runs from GitHub Actions (or locally). For today's date:
 *   1. Checks whether today's answers already exist in Supabase.
 *   2. If not, asks Claude to generate a Mini crossword (5 across + 5 down,
 *      each with clue, answer, explanation) and today's Wordle answer.
 *   3. Inserts the rows into the Supabase `answers` table.
 *   4. Triggers a Vercel redeploy via the deploy hook so the static pages
 *      pick up the new content.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, ANTHROPIC_API_KEY
 * Optional:
 *   VERCEL_DEPLOY_HOOK_URL, ANTHROPIC_MODEL (default: claude-sonnet-4-6)
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEPLOY_HOOK = process.env.VERCEL_DEPLOY_HOOK_URL;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

if (!SUPABASE_URL || !SERVICE_ROLE || !ANTHROPIC_API_KEY) {
  console.error(
    "Missing required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, ANTHROPIC_API_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Today's calendar day in UTC (YYYY-MM-DD). */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function answersExist(date) {
  const { count, error } = await supabase
    .from("answers")
    .select("*", { count: "exact", head: true })
    .eq("publish_date", date)
    .in("type", ["nyt-mini", "wordle"]);
  if (error) throw new Error(`check failed: ${error.message}`);
  return (count ?? 0) >= 2;
}

const PROMPT = (date) => `You are generating puzzle content for ${date} for a free daily puzzle site.

Return ONLY a single JSON object (no markdown, no code fences, no commentary) with this exact shape:

{
  "mini": {
    "across": [
      {"number": 1, "clue": "<clue>", "answer": "<UPPERCASE 3-5 letters>", "explanation": "<one sentence>"}
    ],
    "down": [ ... ],
    "summary": "<one or two sentences summarizing today's mini>"
  },
  "wordle": {
    "answer": "<a real common 5-letter English word, UPPERCASE>",
    "hint_first_letter": "<first letter, uppercase>",
    "hint_vowels": <integer count of vowels a,e,i,o,u — do not count y>,
    "summary": "<one sentence about the word>"
  }
}

Rules:
- mini.across must have exactly 5 entries with numbers 1,4,6,7,8.
- mini.down must have exactly 5 entries with numbers 1,2,3,4,5.
- Every answer is UPPERCASE letters only (no spaces or punctuation).
- Vary clue themes (vocabulary, geography, pop culture, wordplay).
- The wordle answer must be exactly 5 letters and hint_vowels must be counted correctly.
- Output valid JSON only.`;

function extractJson(text) {
  // Strip code fences if the model added them, then parse the first {...} block.
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function generate(date) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: PROMPT(date) }],
  });
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return extractJson(text);
}

function validate(data) {
  const m = data?.mini;
  const w = data?.wordle;
  if (!m || !Array.isArray(m.across) || m.across.length !== 5) {
    throw new Error("invalid mini.across");
  }
  if (!Array.isArray(m.down) || m.down.length !== 5) {
    throw new Error("invalid mini.down");
  }
  if (!w || typeof w.answer !== "string" || w.answer.length !== 5) {
    throw new Error("invalid wordle.answer");
  }
  return true;
}

async function main() {
  const date = todayISO();
  console.log(`Generating content for ${date} using ${MODEL}`);

  if (await answersExist(date)) {
    console.log("Answers already exist for today — nothing to do.");
    return;
  }

  const data = await generate(date);
  validate(data);

  const rows = [
    {
      publish_date: date,
      type: "nyt-mini",
      answer_data: { across: data.mini.across, down: data.mini.down },
      summary: data.mini.summary ?? null,
    },
    {
      publish_date: date,
      type: "wordle",
      answer_data: {
        answer: data.wordle.answer.toUpperCase(),
        hint_first_letter: data.wordle.hint_first_letter,
        hint_vowels: data.wordle.hint_vowels,
      },
      summary: data.wordle.summary ?? null,
    },
  ];

  const { error } = await supabase.from("answers").insert(rows);
  if (error) throw new Error(`insert failed: ${error.message}`);
  console.log(`Inserted ${rows.length} answer rows for ${date}.`);

  if (DEPLOY_HOOK) {
    const res = await fetch(DEPLOY_HOOK, { method: "POST" });
    console.log(`Deploy hook triggered: ${res.status}`);
  } else {
    console.log("No VERCEL_DEPLOY_HOOK_URL set — skipping redeploy.");
  }
}

main().catch((err) => {
  console.error("❌ generate-daily-content failed:", err.message);
  process.exit(1);
});
