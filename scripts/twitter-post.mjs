/**
 * Generate a daily tweet: an emoji-grid teaser for today's Wordle plus a hint,
 * linking to /wordle-answer/today. Prints to console for manual posting.
 *
 * Run:  node --env-file=.env.local scripts/twitter-post.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SITE = "https://www.funzzle.com";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
const today = new Date().toISOString().slice(0, 10);

async function getHint() {
  if (!url || !serviceRole) return null;
  try {
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("answers")
      .select("answer_data")
      .eq("publish_date", today)
      .eq("type", "wordle")
      .maybeSingle();
    return data?.answer_data ?? null;
  } catch {
    return null;
  }
}

// Decorative, non-spoiler teaser grid seeded from the date.
function teaserGrid(seed) {
  const tiles = ["🟩", "🟨", "⬛"];
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const rows = [];
  for (let r = 0; r < 3; r++) {
    let row = "";
    for (let c = 0; c < 5; c++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      row += tiles[s % tiles.length];
    }
    rows.push(row);
  }
  return rows.join("\n");
}

const hint = await getHint();
const first = hint?.hint_first_letter ?? "?";
const vowels = hint?.hint_vowels ?? "?";

const tweet = `Today's #Wordle hint 🟩

${teaserGrid(today)}

Starts with: ${first}
Vowels: ${vowels}

No spoilers — tap to reveal the answer 👇
${SITE}/wordle-answer/today

#wordle #wordlehint #puzzles`;

console.log("=".repeat(60));
console.log(`TWEET (${tweet.length} chars)`);
console.log("=".repeat(60));
console.log(tweet);
if (tweet.length > 280) console.log("\n[warn] Over 280 characters — trim before posting.");
if (!hint) console.log("\n[note] No Supabase hint available; used placeholders.");
