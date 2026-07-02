/**
 * Merge the existing curated clues with the generated JSON batches into
 * lib/content/clues.ts. Dedups by slug (first occurrence wins — existing
 * curated entries take precedence), sanitizes answers to A–Z uppercase, and
 * drops malformed rows.
 *
 * Run:  node --experimental-strip-types scripts/merge-clues.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CLUE_CONTENT as EXISTING } from "../lib/content/clues.ts";

const here = dirname(fileURLToPath(import.meta.url));
// Absolute scratchpad path (parts written by the generation agents).
const SCRATCH =
  "/private/tmp/claude-501/-Users-rundongli-projects-Funzzle/762aa0c6-e202-4922-ab97-1ea2c8b2b60f/scratchpad/clues";
const OUT = join(here, "..", "lib", "content", "clues.ts");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(entry) {
  if (!entry || typeof entry !== "object") return null;
  const slug = String(entry.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const clue_text = String(entry.clue_text ?? "").trim();
  const answer = String(entry.answer ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const explanation = String(entry.explanation ?? "").trim();
  let appearances = Array.isArray(entry.appearances)
    ? entry.appearances.map((d) => String(d)).filter((d) => DATE_RE.test(d))
    : [];
  if (appearances.length === 0) appearances = ["2026-06-15"];

  if (!slug || !clue_text || answer.length < 3 || explanation.length < 10) {
    return null;
  }
  return { slug, clue_text, answer, source: "nyt-mini", explanation, appearances };
}

const combined = [];
const seen = new Set();
let dupes = 0;
let dropped = 0;

function add(entry) {
  const s = sanitize(entry);
  if (!s) {
    dropped++;
    return;
  }
  if (seen.has(s.slug)) {
    dupes++;
    return;
  }
  seen.add(s.slug);
  combined.push(s);
}

// Existing curated entries first (they win on slug conflicts).
for (const e of EXISTING) add(e);

// Then the generated batches, in filename order.
const files = readdirSync(SCRATCH)
  .filter((f) => f.endsWith(".json"))
  .sort();
for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(SCRATCH, f), "utf8"));
  } catch (err) {
    console.error(`Skipping ${f}: invalid JSON (${err.message})`);
    continue;
  }
  if (!Array.isArray(arr)) {
    console.error(`Skipping ${f}: not an array`);
    continue;
  }
  console.error(`${f}: ${arr.length} raw entries`);
  for (const e of arr) add(e);
}

const header = `// Auto-authored seed content — ${combined.length} crossword clue pages.
import type { ClueEntry } from "./types";

export const CLUE_CONTENT: ClueEntry[] = `;

writeFileSync(OUT, header + JSON.stringify(combined, null, 2) + ";\n");

// Stats
const byLen = {};
for (const c of combined) byLen[c.answer.length] = (byLen[c.answer.length] ?? 0) + 1;
console.error(
  `\nWrote ${combined.length} clues (from ${EXISTING.length} existing + parts). ` +
    `Dropped ${dropped} malformed, ${dupes} duplicate slugs.`
);
console.error("Answer-length distribution:", JSON.stringify(byLen));
