/**
 * Seed all local content into Supabase (answers + clues + today's mini puzzle).
 * Idempotent: deletes matching rows first, then inserts.
 *
 * Run with:
 *   node --experimental-strip-types --env-file=.env.local scripts/seed.mjs
 *
 * (Node's type stripping lets us import the TypeScript content modules directly.
 *  Those modules use type-only relative imports, so no extra resolution needed.)
 */
import { createClient } from "@supabase/supabase-js";
import { DAILY_CONTENT } from "../lib/content/dailyAnswers.ts";
import { WORDLE_BY_DATE } from "../lib/content/wordleAnswers.ts";
import { CLUE_CONTENT } from "../lib/content/clues.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  process.exit(1);
}
const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false },
});

function buildAnswerRows() {
  const rows = [];
  for (const day of DAILY_CONTENT) {
    rows.push({
      publish_date: day.date,
      type: "nyt-mini",
      answer_data: day.mini,
      summary: day.miniSummary,
    });
    const wordle = WORDLE_BY_DATE[day.date];
    rows.push({
      publish_date: day.date,
      type: "wordle",
      answer_data: wordle ? wordle.answer_data : day.wordle,
      summary: wordle ? wordle.summary : day.wordleSummary,
    });
  }
  return rows;
}

function buildClueRows() {
  return CLUE_CONTENT.map((c) => ({
    slug: c.slug,
    clue_text: c.clue_text,
    answer: c.answer,
    source: c.source,
    explanation: c.explanation,
    // The DB column is an integer count; appearance dates live in local content.
    appearances: c.appearances.length,
  }));
}

async function seedAnswers() {
  const rows = buildAnswerRows();
  const dates = [...new Set(rows.map((r) => r.publish_date))];
  const { error: delErr } = await supabase
    .from("answers")
    .delete()
    .in("publish_date", dates);
  if (delErr) throw new Error(`answers delete: ${delErr.message}`);
  const { error } = await supabase.from("answers").insert(rows);
  if (error) throw new Error(`answers insert: ${error.message}`);
  console.log(`Seeded ${rows.length} answer rows across ${dates.length} days.`);
}

async function seedClues() {
  const rows = buildClueRows();
  const slugs = rows.map((r) => r.slug);
  const { error: delErr } = await supabase
    .from("clues")
    .delete()
    .in("slug", slugs);
  if (delErr) throw new Error(`clues delete: ${delErr.message}`);
  const { error } = await supabase.from("clues").insert(rows);
  if (error) throw new Error(`clues insert: ${error.message}`);
  console.log(`Seeded ${rows.length} clue rows.`);
}

try {
  await seedAnswers();
  await seedClues();
  console.log("✅ Seed complete.");
} catch (err) {
  console.error("❌ Seed failed:", err.message);
  console.error(
    "If this is a permission error, run supabase/setup.sql (or supabase/seed-all.sql) in the Supabase SQL Editor to grant table access first."
  );
  process.exit(1);
}
