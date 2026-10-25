/**
 * Try the explain cron's DeepSeek content generators locally, with the real
 * prompts and validation, and print every rejection reason. Writes nothing:
 * lib/db is swapped for scripts/lib/db-stub.ts (no D1 at all).
 *
 *   npx esbuild scripts/try-content.ts --bundle --platform=node --format=esm \
 *     --packages=external --alias:@/lib/db=./scripts/lib/db-stub.ts \
 *     --outfile=node_modules/.cache/try-content.mjs
 *   node node_modules/.cache/try-content.mjs [--games=groups,word-hunt,word-search] [--dates=3] [--from=2026-11-01]
 *
 * Needs DEEPSEEK_API_KEY (environment, or .env.local). Each date costs at most
 * 8 Groups, 3 Word Hunt and 3 Word Search calls (a fraction of a cent each).
 */
import fs from "node:fs";
import { generateGroups } from "@/lib/cron/content/groups";
import { aiPuzzle } from "@/lib/cron/content/wordhunt";
import { wordSearchFor } from "@/lib/cron/content/wordsearch";
import { THEMES } from "@/lib/games/wordsearch/themes";
import { exec as dbExec } from "@/lib/db";
import { exec as stubExec, usage } from "./lib/db-stub";

// Never run against the real lib/db (it would reach the production D1): bundle with the alias.
if (dbExec !== stubExec) {
  console.error("Bundle with --alias:@/lib/db=./scripts/lib/db-stub.ts");
  process.exit(1);
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

if (!process.env.DEEPSEEK_API_KEY) {
  try {
    const m = fs.readFileSync(".env.local", "utf8").match(/^DEEPSEEK_API_KEY=(.+)$/m);
    if (m) process.env.DEEPSEEK_API_KEY = m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // no .env.local
  }
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error("Set DEEPSEEK_API_KEY (or put it in .env.local).");
  process.exit(1);
}

const games = (arg("games") ?? "groups,word-hunt,word-search").split(",");
const from = arg("from") ?? shift(new Date().toISOString().slice(0, 10), 7);
const dates = Array.from({ length: Number(arg("dates") ?? 3) }, (_, i) => shift(from, i));

interface Tally {
  ok: number;
  failed: number;
  calls: number;
  reasons: string[];
}
const tally: Record<string, Tally> = {};
const record = (game: string, ok: boolean, calls: number, reasons: string[], what: string) => {
  const t = (tally[game] ??= { ok: 0, failed: 0, calls: 0, reasons: [] });
  t[ok ? "ok" : "failed"]++;
  t.calls += calls;
  t.reasons.push(...reasons);
  console.log(`\n${game} ${what}: ${ok ? "OK" : "FAILED"} after ${calls} call(s)`);
  for (const r of reasons) console.log(`  - ${r}`);
};

for (const date of dates) {
  if (games.includes("groups")) {
    const r = await generateGroups(date, []);
    record("groups", Boolean(r.puzzle), r.calls, r.reasons, date);
    if (r.puzzle) for (const g of r.puzzle.groups) console.log(`  ${g.level}. ${g.title}: ${g.words.join(", ")}  (${g.hint})`);
  }
  if (games.includes("word-hunt")) {
    const r = await aiPuzzle(date, []);
    record("word-hunt", Boolean(r.puzzle), r.calls, r.reasons, date);
    if (r.puzzle) console.log(`  ${r.puzzle.puzzle.title}: ${r.puzzle.puzzle.words.map((w) => (w.span ? `[${w.word}]` : w.word)).join(", ")}`);
  }
  if (games.includes("word-search")) {
    const r = await wordSearchFor(date, THEMES.map((t) => t.title));
    record("word-search", Boolean(r.puzzle), r.calls, r.reasons, date);
    if (r.puzzle) console.log(`  ${r.puzzle.title}: ${r.puzzle.words.map((w) => w.word).join(", ")}`);
  }
}

console.log("\n=== Summary ===");
for (const [game, t] of Object.entries(tally)) {
  console.log(`${game}: ${t.ok}/${t.ok + t.failed} dates OK, ${t.calls} calls, ${t.reasons.length} rejections`);
}
console.log(`DeepSeek: ${usage.calls} calls, ${usage.promptTokens} prompt + ${usage.completionTokens} completion tokens, $${usage.costUsd.toFixed(4)}`);
