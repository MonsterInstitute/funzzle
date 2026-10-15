/**
 * Backfill REAL answers for a range of past dates by reusing the exact same
 * builders the daily job uses (fetch real public answer -> DeepSeek explanations
 * -> upsert). Covers Wordle, Connections and the NYT Mini.
 *
 * NON-DESTRUCTIVE: a (date, game) that fails to fetch is reported and SKIPPED —
 * any existing row for that date/type is left untouched, so a flaky source can
 * never wipe good data. --missing-only also leaves every existing row alone and
 * only fills gaps.
 *
 * FAILS LOUDLY: prints a per-date, per-game summary with the reason for every
 * failure and exits non-zero if any (date, game) failed.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-answers.mjs --last=8
 *   node --env-file=.env.local scripts/backfill-answers.mjs 2026-07-01 2026-07-02 ...
 *   node --env-file=.env.local scripts/backfill-answers.mjs --last=8 --games=wordle,connections
 *   node --env-file=.env.local scripts/backfill-answers.mjs --last=16 --games=nyt-mini --missing-only
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE (required),
 *      DEEPSEEK_API_KEY (optional, for explanations).
 */
import { createClient } from "@supabase/supabase-js";
import { GAMES, upsertAnswer } from "./generate-daily-content.mjs";

function shiftISO(dateISO, days) {
  const dt = new Date(`${dateISO}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

const args = process.argv.slice(2);
const explicitDates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const lastArg = args.find((a) => a.startsWith("--last="));
const gamesArg = args.find((a) => a.startsWith("--games="));
const missingOnly = args.includes("--missing-only");

let dates = explicitDates;
if (lastArg) {
  const n = Number.parseInt(lastArg.slice("--last=".length), 10);
  const today = new Date().toISOString().slice(0, 10);
  // today and the previous n-1 days, oldest first
  dates = Array.from({ length: n }, (_, i) => shiftISO(today, -(n - 1 - i)));
}
if (dates.length === 0) {
  console.error("Usage: backfill-answers.mjs (--last=N | <YYYY-MM-DD>...) [--games=wordle,connections,nyt-mini] [--missing-only]");
  process.exit(1);
}

const wantGames = gamesArg
  ? gamesArg.slice("--games=".length).split(",").map((s) => s.trim())
  : GAMES.map((g) => g.key);
const games = GAMES.filter((g) => wantGames.includes(g.key));
const unknown = wantGames.filter((k) => !GAMES.some((g) => g.key === k));
if (unknown.length || games.length === 0) {
  console.error(`Unknown game(s): ${unknown.join(", ") || "(none selected)"} — use ${GAMES.map((g) => g.key).join(", ")}`);
  process.exit(1);
}

let existing = new Set();
if (missingOnly) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.from("answers").select("publish_date, type").in("publish_date", dates);
  if (error) {
    console.error(`Reading existing rows failed: ${error.message}`);
    process.exit(1);
  }
  existing = new Set(data.map((r) => `${r.publish_date}|${r.type}`));
}

console.log(
  `Backfilling [${games.map((g) => g.key).join(", ")}]${missingOnly ? " (missing rows only)" : ""} for: ${dates.join(", ")}\n`
);

const results = {}; // date -> { game -> "ok ..."|"present"|"FAIL: ..." }
for (const date of dates) {
  results[date] = {};
  for (const game of games) {
    if (existing.has(`${date}|${game.key}`)) {
      results[date][game.key] = "present";
      continue;
    }
    try {
      const { row, source } = await game.build(date);
      await upsertAnswer(row);
      const detail =
        game.key === "wordle"
          ? row.answer_data.answer
          : game.key === "connections"
          ? `${row.answer_data.groups.length} groups`
          : `${row.answer_data.across.length}A/${row.answer_data.down.length}D`;
      results[date][game.key] = `ok (${source}): ${detail}`;
      console.log(`✅ ${date} ${game.label}: ${detail}  [${source}]`);
    } catch (err) {
      results[date][game.key] = `FAIL: ${err.message}`;
      console.error(`❌ ${date} ${game.label}: ${err.message}`);
    }
  }
}

// Summary matrix
console.log("\n===== BACKFILL SUMMARY =====");
const pad = (s, n) => String(s).padEnd(n);
const mark = (v) => (v.startsWith("ok") ? "✓" : v === "present" ? "· exists" : "✗ FAIL");
console.log(pad("date", 12) + games.map((g) => pad(g.key, 14)).join(""));
for (const date of dates) {
  console.log(pad(date, 12) + games.map((g) => pad(mark(results[date][g.key]), 14)).join(""));
}
const failed = dates.flatMap((date) =>
  games.filter((g) => results[date][g.key].startsWith("FAIL")).map((g) => `${date} ${g.key}: ${results[date][g.key].slice(6)}`)
);
const written = Object.values(results).flatMap((r) => Object.values(r)).filter((v) => v.startsWith("ok")).length;
console.log(`\n${written} row(s) written.`);
if (failed.length) {
  console.error(`\n${failed.length} (date, game) failed — existing rows left untouched:`);
  for (const f of failed) console.error(`  ✗ ${f}`);
  process.exit(1);
}
