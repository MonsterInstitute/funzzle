/**
 * Seed sample answers into Supabase so pages render immediately.
 * Run with:  node --env-file=.env.local scripts/seed.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceRole) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE.");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false },
});

const rows = [
  {
    publish_date: "2026-07-01",
    type: "nyt-mini",
    answer_data: {
      across: [
        { number: 1, clue: "Opposite of subtract", answer: "ADD" },
        { number: 4, clue: "Angry", answer: "MAD" },
        { number: 5, clue: "Cooking vessel", answer: "PAN" },
      ],
      down: [
        { number: 1, clue: "Father, informally", answer: "DAD" },
        { number: 2, clue: "Exist", answer: "ARE" },
        { number: 3, clue: "Dampness", answer: "DEN" },
      ],
    },
    summary:
      "Today's NYT Mini was a quick solve with a math theme. ADD anchored the across clues, making this a Monday-easy puzzle.",
  },
  {
    publish_date: "2026-07-01",
    type: "wordle",
    answer_data: {
      answer: "CRANE",
      hint_first_letter: "C",
      hint_vowels: 2,
    },
    summary:
      "Today's Wordle answer is CRANE — a bird and a construction machine. Common starting guesses like RAISE or SLATE would get you close quickly.",
  },
];

for (const row of rows) {
  // Remove any existing row for this date+type so re-runs are idempotent.
  await supabase
    .from("answers")
    .delete()
    .eq("publish_date", row.publish_date)
    .eq("type", row.type);

  const { error } = await supabase.from("answers").insert(row);
  if (error) {
    console.error(`Failed to insert ${row.type} (${row.publish_date}):`, error.message);
    process.exitCode = 1;
  } else {
    console.log(`Seeded ${row.type} for ${row.publish_date}`);
  }
}
