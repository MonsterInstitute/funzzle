/**
 * Scrape Google Autocomplete for 20 puzzle-related queries, find content gaps,
 * and output new page opportunities to scripts/trending-opportunities.json.
 *
 * A suggestion is flagged as an OPPORTUNITY when it looks like search-intent we
 * could target with a page (contains "answer", "hint", "today", "solution",
 * etc.) and doesn't obviously map to a route we already publish.
 *
 * Run:  node scripts/trending-keywords.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "trending-opportunities.json");

const QUERIES = [
  "wordle answer today",
  "wordle hint",
  "nyt connections",
  "connections answer",
  "connections hint today",
  "nyt mini crossword answers",
  "nyt crossword answers",
  "spelling bee answers today",
  "spelling bee pangram",
  "strands answer today",
  "strands spangram",
  "quordle answers today",
  "quordle practice",
  "nerdle answer today",
  "worldle answer today",
  "letter boxed answers today",
  "free wordle unlimited",
  "crossword clue",
  "5 letter words",
  "daily word games",
];

// Routes/patterns we already cover — used to judge whether a keyword is a gap.
const COVERED = [
  "wordle answer",
  "mini crossword",
  "nyt crossword answers",
  "connections",
  "spelling bee",
  "strands",
  "quordle",
  "nerdle",
  "worldle",
  "letter boxed",
  "crossword clue",
  "free wordle",
];

const INTENT = ["answer", "hint", "solution", "today", "unlimited", "words", "pangram", "spangram"];

async function suggest(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const data = await res.json();
    return Array.isArray(data?.[1]) ? data[1] : [];
  } catch (err) {
    console.error(`  suggest("${q}") failed: ${err.message}`);
    return [];
  }
}

async function main() {
  const opportunities = [];
  const seen = new Set();

  for (const q of QUERIES) {
    const suggestions = await suggest(q);
    for (const s of suggestions) {
      const kw = s.toLowerCase().trim();
      if (seen.has(kw)) continue;
      seen.add(kw);
      const hasIntent = INTENT.some((t) => kw.includes(t));
      const covered = COVERED.some((c) => kw.includes(c));
      if (hasIntent && !covered) {
        opportunities.push({ keyword: kw, seed: q });
      }
    }
    console.log(`${q}: ${suggestions.length} suggestions`);
  }

  const payload = {
    generated: new Date().toISOString(),
    count: opportunities.length,
    opportunities,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2));

  console.log(`\nFound ${opportunities.length} potential page opportunities (gaps):`);
  for (const o of opportunities.slice(0, 40)) console.log(`  • ${o.keyword}  (from "${o.seed}")`);
  console.log(`\nWritten to ${OUT}`);
}

main();
