/**
 * Generate a daily tweet: an emoji-grid teaser for today's Wordle plus a hint,
 * linking to /wordle-answer/today. Prints to console for manual posting.
 *
 * Run:  node scripts/twitter-post.mjs
 */
import { d1 } from "./lib/d1-rest.mjs";

const SITE = "https://www.funzzle.com";
const today = new Date().toISOString().slice(0, 10);

async function getHint() {
  try {
    const [row] = await d1("SELECT answer_data FROM answers WHERE publish_date = ? AND type = 'wordle'", [today]);
    const data = row ? { ...row, answer_data: JSON.parse(row.answer_data) } : null;
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
if (!hint) console.log("\n[note] No stored hint available; used placeholders.");
