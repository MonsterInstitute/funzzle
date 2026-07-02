/**
 * Generate supabase/seed-all.sql from the local content modules.
 * Pure — no database access. Run with:
 *   node --experimental-strip-types scripts/generate-seed-sql.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DAILY_CONTENT } from "../lib/content/dailyAnswers.ts";
import { WORDLE_BY_DATE } from "../lib/content/wordleAnswers.ts";
import { CLUE_CONTENT } from "../lib/content/clues.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "supabase", "seed-all.sql");

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const j = (obj) => q(JSON.stringify(obj));

const GRANTS = `-- ============================================================================
-- Funzzle full seed — grants + 31 days of answers + 50 clues.
-- Run ONCE in the Supabase Dashboard → SQL Editor.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clues   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read answers" ON public.answers;
CREATE POLICY "public read answers" ON public.answers FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read puzzles" ON public.puzzles;
CREATE POLICY "public read puzzles" ON public.puzzles FOR SELECT USING (true);
DROP POLICY IF EXISTS "public read clues" ON public.clues;
CREATE POLICY "public read clues" ON public.clues FOR SELECT USING (true);
`;

const dates = DAILY_CONTENT.map((d) => d.date);
const lines = [GRANTS, ""];

// Answers
lines.push("-- Answers ---------------------------------------------------------------");
lines.push(
  `DELETE FROM public.answers WHERE publish_date IN (${dates.map(q).join(", ")});`
);
const answerValues = [];
for (const day of DAILY_CONTENT) {
  answerValues.push(
    `(${q(day.date)}, 'nyt-mini', ${j(day.mini)}::jsonb, ${q(day.miniSummary)})`
  );
  const w = WORDLE_BY_DATE[day.date];
  const data = w ? w.answer_data : day.wordle;
  const summary = w ? w.summary : day.wordleSummary;
  answerValues.push(
    `(${q(day.date)}, 'wordle', ${j(data)}::jsonb, ${q(summary)})`
  );
}
lines.push(
  `INSERT INTO public.answers (publish_date, type, answer_data, summary) VALUES\n${answerValues.join(",\n")};`
);
lines.push("");

// Clues
lines.push("-- Clues -----------------------------------------------------------------");
const slugs = CLUE_CONTENT.map((c) => c.slug);
lines.push(
  `DELETE FROM public.clues WHERE slug IN (${slugs.map(q).join(", ")});`
);
const clueValues = CLUE_CONTENT.map(
  (c) =>
    `(${q(c.slug)}, ${q(c.clue_text)}, ${q(c.answer)}, ${q(c.source)}, ${q(c.explanation)}, ${c.appearances.length})`
);
lines.push(
  `INSERT INTO public.clues (slug, clue_text, answer, source, explanation, appearances) VALUES\n${clueValues.join(",\n")};`
);
lines.push("");

writeFileSync(outPath, lines.join("\n"));
console.log(
  `Wrote ${outPath}: ${answerValues.length} answer rows, ${clueValues.length} clue rows.`
);
