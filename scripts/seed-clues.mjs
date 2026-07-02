/**
 * Seed the clues table from lib/content/clues.ts.
 * Deletes all existing clue rows, then inserts in chunks (avoids a huge
 * .in() filter). The DB `appearances` column is an integer count.
 *
 * Run:  node --experimental-strip-types --env-file=.env.local scripts/seed-clues.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { CLUE_CONTENT } from "../lib/content/clues.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  process.exit(1);
}
const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

const rows = CLUE_CONTENT.map((c) => ({
  slug: c.slug,
  clue_text: c.clue_text,
  answer: c.answer,
  source: c.source,
  explanation: c.explanation,
  appearances: c.appearances.length, // DB column is an integer count
}));

const CHUNK = 500;

async function main() {
  console.log(`Seeding ${rows.length} clues...`);

  // Delete all existing clue rows (table holds only our seed data).
  // id is a UUID, so filter on a column that's non-null for every row.
  const { error: delErr } = await supabase
    .from("clues")
    .delete()
    .not("id", "is", null);
  if (delErr) throw new Error(`delete failed: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("clues").insert(batch);
    if (error) throw new Error(`insert (batch ${i / CHUNK}) failed: ${error.message}`);
    console.log(`  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  const { count } = await supabase
    .from("clues")
    .select("*", { count: "exact", head: true });
  console.log(`✅ Done. clues table now has ${count} rows.`);
}

main().catch((err) => {
  console.error("❌ seed-clues failed:", err.message);
  process.exit(1);
});
