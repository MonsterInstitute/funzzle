/**
 * Discover keyword opportunities from Google Autocomplete.
 * Fetches suggestions for a set of seed queries and logs new keywords to
 * scripts/keyword-opportunities.json.
 *
 * Run:  node scripts/discover-keywords.mjs
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "keyword-opportunities.json");

const SEEDS = [
  "wordle answer",
  "nyt crossword",
  "connections puzzle",
  "nyt mini crossword",
  "spelling bee answers",
  "strands hint",
  "quordle answer",
  "nerdle answer",
  "worldle country",
  "letter boxed solution",
];

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
  const known = existsSync(OUT)
    ? new Set(JSON.parse(readFileSync(OUT, "utf8")).map((k) => k.keyword))
    : new Set();

  const found = [];
  for (const seed of SEEDS) {
    const suggestions = await suggest(seed);
    for (const s of suggestions) {
      const kw = s.toLowerCase().trim();
      if (!known.has(kw)) {
        known.add(kw);
        found.push({ keyword: kw, seed, discovered: new Date().toISOString().slice(0, 10) });
      }
    }
    console.log(`${seed}: ${suggestions.length} suggestions`);
  }

  const all = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const merged = [...all, ...found];
  writeFileSync(OUT, JSON.stringify(merged, null, 2));
  console.log(`\nNew keywords this run: ${found.length}. Total tracked: ${merged.length}.`);
  if (found.length) {
    console.log("New opportunities:");
    for (const f of found.slice(0, 30)) console.log(`  • ${f.keyword}`);
  }
}

main();
