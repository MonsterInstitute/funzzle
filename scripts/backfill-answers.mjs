/**
 * Backfill REAL answers for a range of past dates with the same public-source
 * fetchers the answers cron uses, written to D1 over the REST API. Covers
 * Wordle, Connections and the NYT Mini. Rows are stored without DeepSeek
 * prose (summary NULL); the explain cron only covers today and tomorrow, so
 * backfilled pages show the answers and hints without the explanations.
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
 *   node scripts/backfill-answers.mjs --last=8
 *   node scripts/backfill-answers.mjs 2026-07-01 2026-07-02 ...
 *   node scripts/backfill-answers.mjs --last=8 --games=wordle,connections
 *   node scripts/backfill-answers.mjs --last=16 --games=nyt-mini --missing-only
 * then refresh the pages: REVALIDATE_SECRET=… node scripts/revalidate-site.mjs --last=8
 *
 * Auth: CLOUDFLARE_API_TOKEN (D1 Edit) or a local `wrangler login`.
 */
import { d1 } from "./lib/d1-rest.mjs";
import { fetchConnections, fetchMini, fetchWordle } from "./fetch-public-answers.mjs";

const GAMES = [
  { key: "wordle", label: "Wordle", fetch: fetchWordle },
  { key: "connections", label: "Connections", fetch: fetchConnections },
  { key: "nyt-mini", label: "NYT Mini", fetch: fetchMini },
];

/** Replace the answers for (date, type), keeping the row's created_at. */
async function upsertAnswer(row) {
  await d1(
    `INSERT INTO answers (publish_date, type, answer_data, summary) VALUES (?, ?, ?, NULL)
     ON CONFLICT(publish_date, type) DO UPDATE SET answer_data = excluded.answer_data, summary = NULL,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    [row.publish_date, row.type, JSON.stringify(row.answer_data)]
  );
}

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
  const rows = await d1(`SELECT publish_date, type FROM answers WHERE publish_date IN (${dates.map(() => "?").join(", ")})`, dates);
  existing = new Set(rows.map((r) => `${r.publish_date}|${r.type}`));
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
      const { answer_data, source } = await game.fetch(date);
      const row = { publish_date: date, type: game.key, answer_data };
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
