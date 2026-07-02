/**
 * Generate daily Reddit post text for r/wordle and r/crossword using today's
 * HINT (never the answer), linking back to funzzle.com. Prints to console for
 * manual posting.
 *
 * Run:  node --env-file=.env.local scripts/reddit-post.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SITE = "https://funzzle.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const today = new Date().toISOString().slice(0, 10);

async function getWordleHint() {
  if (!url || !serviceRole) return null;
  try {
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("answers")
      .select("answer_data, summary")
      .eq("publish_date", today)
      .eq("type", "wordle")
      .maybeSingle();
    if (!data) return null;
    return {
      first: data.answer_data?.hint_first_letter ?? "?",
      vowels: data.answer_data?.hint_vowels ?? "?",
      summary: data.summary ?? "",
    };
  } catch {
    return null;
  }
}

const hint = await getWordleHint();

const wordleFirst = hint?.first ?? "?";
const wordleVowels = hint?.vowels ?? "?";

const rWordle = `Title: Daily Wordle hint thread — ${today} (no spoilers)

Body:
Stuck on today's Wordle but don't want the answer spoiled? Here are gentle hints:

• Starts with the letter: ${wordleFirst}
• Number of vowels: ${wordleVowels}
• No proper nouns today.

Full hints (and the answer, blurred until you tap) are here: ${SITE}/wordle-answer/today
Want unlimited practice? Free Wordle: ${SITE}/play/wordle

(Not affiliated with the NYT — just a free place to play and check answers.)`;

const rCrossword = `Title: NYT Mini Crossword answers & hints — ${today}

Body:
Posting today's Mini Crossword answer key with a short explanation for every clue (across and down), plus solving tips: ${SITE}/nyt-crossword-answers/${today}

If you'd rather solve one yourself first, there's a free daily Mini here: ${SITE}/play/mini

Everything's free — no subscription or account.`;

console.log("=".repeat(60));
console.log("r/wordle POST");
console.log("=".repeat(60));
console.log(rWordle);
console.log("\n" + "=".repeat(60));
console.log("r/crossword POST");
console.log("=".repeat(60));
console.log(rCrossword);
if (!hint) {
  console.log("\n[note] No Supabase hint available; used placeholders. Set env or run after daily content generation.");
}
