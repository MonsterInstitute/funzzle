import { describe, expect, it } from "vitest";
import { entryValue, result } from "@/lib/apiValidate";
import { beats, isScoreGame, RESULT_GAMES, resultValue } from "@/lib/games/kit/resultConfig";
import { leagueBoards } from "@/lib/leagueBoard";

describe("score result kind", () => {
  it("marks only the score games as score games", () => {
    expect(isScoreGame("2048")).toBe(true);
    expect(isScoreGame("block-puzzle")).toBe(true);
    expect(isScoreGame("sudoku")).toBe(false);
    expect(isScoreGame("solitaire")).toBe(false);
    expect(isScoreGame("jigsaw")).toBe(false);
    expect(isScoreGame("nope")).toBe(false);
  });

  it("time games still compare timeMs with their minimum", () => {
    expect(resultValue("sudoku", { timeMs: 300_000 })).toBe(300_000);
    expect(resultValue("sudoku", { timeMs: 1_000 })).toBeNull(); // below minMs
    expect(resultValue("sudoku", { timeMs: 300_000, score: 5 })).toBe(300_000);
    expect(resultValue("solitaire", { timeMs: 90_000.5 })).toBeNull();
    expect(resultValue("solitaire", { timeMs: 86_400_001 })).toBeNull();
  });

  it("score games compare the score, not the time", () => {
    expect(resultValue("2048", { timeMs: 60_000, score: 12_480 })).toBe(12_480);
    expect(resultValue("2048", { timeMs: 60_000 })).toBeNull();
    expect(resultValue("block-puzzle", { score: 0 })).toBeNull(); // the value column must be positive
    expect(resultValue("block-puzzle", { score: "900" })).toBeNull();
    expect(resultValue("block-puzzle", { score: 20_000_000 })).toBeNull();
  });

  it("higher wins for scores, lower for times", () => {
    expect(beats("2048", 5000, 4000)).toBe(true);
    expect(beats("2048", 4000, 5000)).toBe(false);
    expect(beats("sudoku", 4000, 5000)).toBe(true);
    expect(beats("sudoku", 5000, 4000)).toBe(false);
  });

  it("score histograms are in points", () => {
    expect(RESULT_GAMES["2048"].lo).toBe(0);
    expect(RESULT_GAMES["2048"].hi).toBeGreaterThan(10_000);
  });
});

describe("challenge entries for score games", () => {
  it("accepts an optional score and ranks score games by it", () => {
    const r = result({ timeMs: 120_000, mistakes: 0, hints: 1, moves: 300, score: 9_120 })!;
    expect(r.score).toBe(9_120);
    expect(entryValue("2048", r)).toBe(9_120);
    expect(entryValue("sudoku", r)).toBe(120_000);
  });
  it("rejects a bad score and a score game without one", () => {
    expect(result({ timeMs: 120_000, mistakes: 0, hints: 0, score: -1 })).toBeNull();
    const noScore = result({ timeMs: 120_000, mistakes: 0, hints: 0 })!;
    expect(noScore.score).toBeNull();
    expect(entryValue("block-puzzle", noScore)).toBeNull();
    expect(entryValue("solitaire", noScore)).toBe(120_000);
    // A zero score is stored as 1: the column is positive.
    expect(entryValue("2048", result({ timeMs: 5_000, mistakes: 0, hints: 0, score: 0 })!)).toBe(1);
  });
});

describe("league boards with score games", () => {
  it("the higher score beats the lower one", () => {
    const boards = leagueBoards(
      ["Ana", "Ben"],
      [
        { name: "Ana", game: "2048", date: "2026-10-20", variant: "", timeMs: 9_000 },
        { name: "Ben", game: "2048", date: "2026-10-20", variant: "", timeMs: 14_000 },
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
