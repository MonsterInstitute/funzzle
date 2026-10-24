import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { belowSql, RESULT_GAMES } from "@/lib/games/kit/resultConfig";

/** The percentile query from app/api/results, run against SQLite (D1's engine). */
function setup(rows: [client: string, timeMs: number, mistakes: number, hints: number][]) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE game_results (game TEXT, puzzle_date TEXT, variant TEXT, client_id TEXT, time_ms INTEGER, mistakes INTEGER, hints INTEGER, moves INTEGER)`);
  const insert = db.prepare("INSERT INTO game_results VALUES ('g', '2026-10-24', '', ?, ?, ?, ?, NULL)");
  for (const r of rows) insert.run(...r);
  return (client: string, rank?: "time" | "mistakes") => (db.prepare(belowSql(rank)).get("g", "2026-10-24", "", client) as { slower: number }).slower;
}

describe("result ranking", () => {
  const below = setup([
    ["fast-sloppy", 40_000, 3, 0],
    ["clean-slow", 300_000, 0, 0],
    ["clean-hinted", 60_000, 0, 2],
    ["clean-fast", 90_000, 0, 0],
  ]);

  it("ranks by time by default (unchanged for existing games)", () => {
    expect(below("fast-sloppy")).toBe(3);
    expect(below("clean-slow")).toBe(0);
    expect(below("clean-fast", "time")).toBe(1);
  });

  it("ranks Groups by mistakes, then hints, then time", () => {
    expect(RESULT_GAMES.groups.rank).toBe("mistakes");
    expect(below("clean-fast", "mistakes")).toBe(3);
    expect(below("clean-slow", "mistakes")).toBe(2);
    expect(below("clean-hinted", "mistakes")).toBe(1);
    expect(below("fast-sloppy", "mistakes")).toBe(0);
  });
});
