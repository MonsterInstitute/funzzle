/**
 * /api/results ranking for move-ranked games (Funzzle Word): fewer guesses
 * first, then time. Runs the route's real SQL on an in-memory SQLite (the
 * same engine as D1) through a stand-in for lib/db.
 */
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { beats } from "@/lib/games/kit/resultConfig";

const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, puzzle_date TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '', client_id TEXT NOT NULL, time_ms INTEGER NOT NULL CHECK (time_ms > 0),
  mistakes INTEGER NOT NULL DEFAULT 0, hints INTEGER NOT NULL DEFAULT 0, moves INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (game, puzzle_date, variant, client_id))`);

// D1 numbers positional "?" and "?N" parameters the same way node:sqlite does.
const bind = (params: unknown[]) => params.map((p) => (p === undefined ? null : p)) as (string | number | null)[];
vi.mock("@/lib/db", () => ({
  exec: async (sql: string, ...params: unknown[]) => Number(db.prepare(sql).run(...bind(params)).changes),
  first: async (sql: string, ...params: unknown[]) => db.prepare(sql).get(...bind(params)) ?? null,
  all: async (sql: string, ...params: unknown[]) => db.prepare(sql).all(...bind(params)),
}));

const { POST } = await import("@/app/api/results/route");
const today = new Date().toISOString().slice(0, 10);
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function submit(body: Record<string, unknown>) {
  const res = await POST(new Request("http://x/api/results", { method: "POST", body: JSON.stringify({ date: today, clientId: uuid(), mistakes: 0, hints: 0, ...body }) }));
  return { status: res.status, json: (await res.json()) as { percentile: number | null; count: number } };
}

describe("word results ranking", () => {
  beforeEach(() => db.exec("DELETE FROM game_results"));

  it("ranks fewer guesses above faster times", async () => {
    // Three players: 4 guesses in 30 s, 3 guesses in 2 min, a miss (7) in 20 s.
    await submit({ game: "word", variant: "classic", timeMs: 30_000, moves: 4 });
    await submit({ game: "word", variant: "classic", timeMs: 20_000, moves: 7 });
    const slowButSharp = await submit({ game: "word", variant: "classic", timeMs: 120_000, moves: 3 });
    expect(slowButSharp.json.percentile).toBe(100);
    // Same guesses: time breaks the tie.
    const tieFast = await submit({ game: "word", variant: "classic", timeMs: 25_000, moves: 4 });
    expect(tieFast.json.percentile).toBe(67); // beats the 30 s four and the miss, not the three
    const miss = await submit({ game: "word", variant: "classic", timeMs: 10_000, moves: 7 });
    expect(miss.json.percentile).toBe(25); // only the slower miss is below
  });

  it("requires a guess count for word results and keeps variants apart", async () => {
    expect((await submit({ game: "word", variant: "classic", timeMs: 30_000 })).status).toBe(400);
    expect((await submit({ game: "word", variant: "classic", timeMs: 30_000, moves: 0 })).status).toBe(400);
    expect((await submit({ game: "word", variant: "nope", timeMs: 30_000, moves: 3 })).status).toBe(400);
    await submit({ game: "word", variant: "quad", timeMs: 30_000, moves: 9 });
    expect((await submit({ game: "word", variant: "geo", timeMs: 30_000, moves: 2 })).json.percentile).toBeNull();
  });

  it("leaves time-ranked games unchanged", async () => {
    await submit({ game: "sudoku", variant: "", timeMs: 300_000 });
    const r = await submit({ game: "sudoku", variant: "", timeMs: 200_000 });
    expect(r.json.percentile).toBe(100);
    expect((await submit({ game: "sudoku", variant: "", timeMs: 400_000 })).json.percentile).toBe(0);
  });

  it("beats() mirrors the SQL rule", () => {
    expect(beats("word", { timeMs: 99_000, moves: 3 }, { timeMs: 1_000, moves: 4 })).toBe(true);
    expect(beats("word", { timeMs: 1_000, moves: 4 }, { timeMs: 2_000, moves: 4 })).toBe(true);
    expect(beats("sudoku", { timeMs: 99_000, moves: 3 }, { timeMs: 1_000, moves: 4 })).toBe(false);
  });
});
