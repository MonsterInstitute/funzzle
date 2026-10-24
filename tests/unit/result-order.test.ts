import { describe, expect, it } from "vitest";
import { compareResults, resultHeadline, resultOrder, resultOrderSql } from "@/lib/games/kit/resultConfig";
import { formatTime } from "@/lib/games/kit/results";
import { leagueBoards } from "@/lib/leagueBoard";

describe("result ordering", () => {
  it("time games are unchanged: faster wins", () => {
    expect(resultOrder("sudoku")).toBe("time");
    expect(resultOrder("unknown-game")).toBe("time");
    expect(resultOrderSql("sudoku")).toBe("time_ms");
    expect(compareResults("sudoku", { timeMs: 100 }, { timeMs: 200 })).toBeLessThan(0);
    expect(resultHeadline("sudoku", { timeMs: 65_000 }, formatTime)).toBe("1:05");
  });

  it("Spelling Hive ranks by score, then time", () => {
    expect(resultOrder("spelling-hive")).toBe("score");
    expect(resultOrderSql("spelling-hive")).toBe("moves DESC, time_ms");
    expect(compareResults("spelling-hive", { timeMs: 900, moves: 120 }, { timeMs: 100, moves: 80 })).toBeLessThan(0);
    expect(compareResults("spelling-hive", { timeMs: 100, moves: 80 }, { timeMs: 900, moves: 80 })).toBeLessThan(0);
    expect(resultHeadline("spelling-hive", { timeMs: 1, moves: 142 }, formatTime)).toBe("142 pts");
  });

  it("Letter Box ranks by fewest words, then time", () => {
    expect(resultOrderSql("letter-box")).toBe("moves, time_ms");
    expect(compareResults("letter-box", { timeMs: 900_000, moves: 2 }, { timeMs: 60_000, moves: 3 })).toBeLessThan(0);
    expect(compareResults("letter-box", { timeMs: 60_000, moves: 2 }, { timeMs: 90_000, moves: 2 })).toBeLessThan(0);
    expect(resultHeadline("letter-box", { timeMs: 192_000, moves: 2 }, formatTime)).toBe("2 words · 3:12");
  });

  it("league boards use the game's order", () => {
    const boards = leagueBoards(
      ["Ana", "Ben"],
      [
        { name: "Ana", game: "spelling-hive", date: "2026-10-19", variant: "", timeMs: 900_000, moves: 150 },
        { name: "Ben", game: "spelling-hive", date: "2026-10-19", variant: "", timeMs: 300_000, moves: 90 },
        { name: "Ana", game: "letter-box", date: "2026-10-19", variant: "", timeMs: 100_000, moves: 3 },
        { name: "Ben", game: "letter-box", date: "2026-10-19", variant: "", timeMs: 400_000, moves: 2 },
      ]
    );
    expect(boards["spelling-hive"][0]).toEqual({ name: "Ana", points: 2, played: 1 });
    expect(boards["letter-box"][0]).toEqual({ name: "Ben", points: 2, played: 1 });
  });
});
