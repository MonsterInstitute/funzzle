/**
 * Fetch the REAL Wordle answer for a given date from NYT's official, free,
 * un-authenticated puzzle endpoint (the same one the Wordle web app calls):
 *
 *   https://www.nytimes.com/svc/wordle/v2/<YYYY-MM-DD>.json
 *   -> { "id": 2395, "solution": "maven", "print_date": "2026-07-02", ... }
 *
 * Wordle is free, so this needs no cookie or subscription — it is the
 * authoritative, date-deterministic source of truth for the daily answer.
 *
 * Usage:
 *   node scripts/fetch-wordle.mjs 2026-07-02
 *   import { fetchWordle } from "./fetch-wordle.mjs"
 */

const V2_URL = (date) => `https://www.nytimes.com/svc/wordle/v2/${date}.json`;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Count vowels a,e,i,o,u (y is not counted), matching the site's hint. */
export function countVowels(word) {
  return (word.toUpperCase().match(/[AEIOU]/g) || []).length;
}

/** Build the answer_data payload used by the `answers` table for Wordle. */
export function toWordleAnswerData(solution) {
  const answer = solution.toUpperCase();
  return {
    answer,
    hint_first_letter: answer[0],
    hint_vowels: countVowels(answer),
  };
}

/**
 * Fetch the real Wordle solution for `date` (YYYY-MM-DD).
 * Returns { date, id, answer_data, editor }. Throws on failure.
 */
export async function fetchWordle(date) {
  const res = await fetch(V2_URL(date), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) {
    throw new Error(`No Wordle published for ${date} yet (HTTP 404).`);
  }
  if (!res.ok) {
    throw new Error(`Wordle fetch failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  const solution = json?.solution;
  if (typeof solution !== "string" || solution.length !== 5) {
    throw new Error(`unexpected Wordle payload: ${JSON.stringify(json)}`);
  }
  return {
    date,
    id: json.id ?? null,
    answer_data: toWordleAnswerData(solution),
    editor: json.editor ?? null,
  };
}

// CLI entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  fetchWordle(date)
    .then((w) => console.log(JSON.stringify(w, null, 2)))
    .catch((err) => {
      console.error("fetch-wordle failed:", err.message);
      process.exit(1);
    });
}
