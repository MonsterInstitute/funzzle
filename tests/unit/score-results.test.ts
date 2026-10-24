import { describe, expect, it } from "vitest";
import { result } from "@/lib/apiValidate";
import { beats, isScoreGame, RESULT_GAMES } from "@/lib/games/kit/resultConfig";
import { leagueBoards } from "@/lib/leagueBoard";

describe("score games", () => {
  it("marks only the score-ordered games as score games", () => {
    expect(isScoreGame("2048")).toBe(true);
    expect(isScoreGame("block-puzzle")).toBe(true);
    expect(isScoreGame("spelling-hive")).toBe(true);
    expect(isScoreGame("sudoku")).toBe(false);
    expect(isScoreGame("jigsaw")).toBe(false);
    expect(isScoreGame("nope")).toBe(false);
  });

  it("higher scores win (score in `moves`), lower times win", () => {
    expect(beats("2048", { timeMs: 90_000, moves: 5000 }, { timeMs: 10_000, moves: 4000 })).toBe(true);
    expect(beats("2048", { timeMs: 10_000, moves: 4000 }, { timeMs: 90_000, moves: 5000 })).toBe(false);
    expect(beats("sudoku", { timeMs: 4000 }, { timeMs: 5000 })).toBe(true);
  });

  it("2048 and Block Puzzle histograms are in points", () => {
    expect(RESULT_GAMES["2048"].histogram).toBe("score");
    expect(RESULT_GAMES["2048"].lo).toBe(0);
    expect(RESULT_GAMES["2048"].hi).toBeGreaterThan(10_000);
    expect(RESULT_GAMES["block-puzzle"].histogram).toBe("score");
  });
});

describe("challenge results", () => {
  it("stores a sent score as the ranked number (moves)", () => {
    const r = result({ timeMs: 120_000, mistakes: 0, hints: 1, moves: 300, score: 9_120 })!;
    expect(r.moves).toBe(9_120);
    const plain = result({ timeMs: 120_000, mistakes: 0, hints: 0, moves: 42 })!;
    expect(plain.moves).toBe(42);
  });
  it("rejects a bad score", () => {
    expect(result({ timeMs: 120_000, mistakes: 0, hints: 0, score: -1 })).toBeNull();
  });
});

describe("league boards with score games", () => {
  it("the higher score beats the lower one", () => {
    const boards = leagueBoards(
      ["Ana", "Ben"],
      [
        { name: "Ana", game: "2048", date: "2026-10-20", variant: "", timeMs: 90_000, moves: 9_000 },
        { name: "Ben", game: "2048", date: "2026-10-20", variant: "", timeMs: 90_000, moves: 14_000 },
        { name: "Ana", game: "sudoku", date: "2026-10-20", variant: "", timeMs: 200_000 },
        { name: "Ben", game: "sudoku", date: "2026-10-20", variant: "", timeMs: 300_000 },
      ]
    );
    expect(boards["2048"].map((r) => [r.name, r.points])).toEqual([
      ["Ben", 2],
      ["Ana", 1],
    ]);
    expect(boards.sudoku.map((r) => [r.name, r.points])).toEqual([
      ["Ana", 2],
      ["Ben", 1],
    ]);
  });
});
