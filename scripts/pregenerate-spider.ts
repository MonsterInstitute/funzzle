/**
 * Pre-generate 2- and 4-suit Spider dailies and store them in D1. They are too
 * heavy for a Worker (up to ~250 MB / ~1 GB and ~16 s; Workers have 128 MB),
 * so the site only ever reads them (lib/games/dailyPuzzles.ts). The answers
 * cron fails, and emails an alert, when fewer than 30 days are stored.
 *
 *   npx esbuild scripts/pregenerate-spider.ts --bundle --platform=node --format=esm \
 *     --packages=external --outfile=node_modules/.cache/pregenerate-spider.mjs
 *   node node_modules/.cache/pregenerate-spider.mjs --from=2026-10-01 --days=400 [--suits=2,4]
 *
 * Idempotent: dates already stored are skipped. Auth as scripts/lib/d1-rest.mjs.
 */
import { generateDailySpider } from "@/lib/games/dailyPuzzles";
import type { SuitCount } from "@/lib/games/spider";
// @ts-expect-error plain .mjs helper without types
import { d1 } from "./lib/d1-rest.mjs";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const from = arg("from") ?? new Date().toISOString().slice(0, 10);
const days = Number(arg("days") ?? 365);
const suitsList = (arg("suits") ?? "2,4").split(",").map(Number) as SuitCount[];
const dates = Array.from({ length: days }, (_, i) => shift(from, i));

const stored = new Set<string>(
  ((await d1("SELECT puzzle_date, variant FROM daily_puzzles WHERE game = 'spider-solitaire' AND puzzle_date BETWEEN ? AND ?", [dates[0], dates.at(-1)])) as {
    puzzle_date: string;
    variant: string;
  }[]).map((r) => `${r.puzzle_date}|${r.variant}`)
);

let written = 0;
for (const date of dates) {
  for (const suits of suitsList) {
    if (stored.has(`${date}|suits${suits}`)) continue;
    const t = Date.now();
    const deal = generateDailySpider(date, suits);
    await d1("INSERT INTO daily_puzzles (game, puzzle_date, variant, data) VALUES ('spider-solitaire', ?, ?, ?) ON CONFLICT DO NOTHING", [
      date,
      `suits${suits}`,
      JSON.stringify(deal),
    ]);
    written++;
    console.log(`${date} suits${suits}: ${deal.solution.length} moves, ${Date.now() - t} ms`);
  }
}
console.log(`Done: ${written} deal(s) written for ${dates[0]} … ${dates.at(-1)}.`);
