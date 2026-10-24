import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { beatenSql, compareResults, RESULT_GAMES } from "@/lib/games/kit/resultConfig";

/** The percentile query from app/api/results, run against SQLite (D1's engine). */
function setup(game: string, rows: [client: string, timeMs: number, mistakes: number, hints: number, moves: number | null][]) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE game_results (game TEXT, puzzle_date TEXT, variant TEXT, client_id TEXT, time_ms INTEGER, mistakes INTEGER, hints INTEGER, moves INTEGER)`);
  const insert = db.prepare(`INSERT INTO game_results VALUES ('${game}', '2026-10-24', '', ?, ?, ?, ?, ?)`);
  for (const r of rows) insert.run(...r);
  const sql = `SELECT count(*) AS slower FROM game_results r,
     (SELECT time_ms, moves, mistakes, hints FROM game_results WHERE game = ?1 AND puzzle_date = ?2 AND variant = ?3 AND client_id = ?4) me
     WHERE r.game = ?1 AND r.puzzle_date = ?2 AND r.variant = ?3 AND ${beatenSql(game)}`;
  return (client: string) => (db.prepare(sql).get(game, "2026-10-24", "", client) as { slower: number }).slower;
}

const rows: [string, number, number, number, number | null][] = [
  ["fast-sloppy", 40_000, 3, 0, 10],
  ["clean-slow", 300_000, 0, 0, 40],
  ["clean-hinted", 60_000, 0, 2, 25],
  ["clean-fast", 90_000, 0, 0, 25],
];

describe("result ranking", () => {
  it("ranks time games by time", () => {
    const below = setup("sudoku", rows);
    expect(below("fast-sloppy")).toBe(3);
    expect(below("clean-slow")).toBe(0);
    expect(below("clean-fast")).toBe(1);
  });

  it("ranks Groups by mistakes, then hints, then time", () => {
    expect(RESULT_GAMES.groups.order).toBe("mistakes");
    const below = setup("groups", rows);
    expect(below("clean-fast")).toBe(3);
    expect(below("clean-slow")).toBe(2);
    expect(below("clean-hinted")).toBe(1);
    expect(below("fast-sloppy")).toBe(0);
  });

  it("ranks score games by score (ties: faster) and fewest-games by count", () => {
    const score = setup("spelling-hive", rows);
    expect(score("clean-slow")).toBe(3);
    expect(score("clean-hinted")).toBe(2);
    expect(score("clean-fast")).toBe(1);
    const fewest = setup("letter-box", rows);
    expect(fewest("fast-sloppy")).toBe(3);
    expect(fewest("clean-slow")).toBe(0);
  });

  it("agrees with compareResults", () => {
    const r = (t: number, m: number, h: number, moves: number) => ({ timeMs: t, mistakes: m, hints: h, moves });
    expect(compareResults("groups", r(90_000, 0, 0, 0), r(40_000, 3, 0, 0))).toBeLessThan(0);
    expect(compareResults("spelling-hive", r(300_000, 0, 0, 40), r(60_000, 0, 0, 25))).toBeLessThan(0);
    expect(compareResults("sudoku", r(40_000, 3, 0, 0), r(90_000, 0, 0, 0))).toBeLessThan(0);
  });
});
