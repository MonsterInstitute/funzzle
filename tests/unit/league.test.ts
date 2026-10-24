import { describe, expect, it } from "vitest";
import { leagueBoards, weekStart } from "@/lib/leagueBoard";

describe("league boards", () => {
  it("scores 1 + members beaten per daily puzzle", () => {
    const boards = leagueBoards(
      ["Ana", "Ben", "Cy"],
      [
        { name: "Ana", game: "sudoku", date: "2026-10-19", variant: "", timeMs: 300_000 },
        { name: "Ben", game: "sudoku", date: "2026-10-19", variant: "", timeMs: 200_000 },
        { name: "Ana", game: "solitaire", date: "2026-10-20", variant: "draw1", timeMs: 100_000 },
        { name: "Ben", game: "solitaire", date: "2026-10-20", variant: "draw3", timeMs: 50_000 },
      ]
    );
    expect(boards.sudoku).toEqual([
      { name: "Ben", points: 2, played: 1 },
      { name: "Ana", points: 1, played: 1 },
    ]);
    // Different variants are different puzzles: nobody beats anybody there.
    expect(boards.solitaire.map((r) => r.points)).toEqual([1, 1]);
    expect(boards.overall.map((r) => [r.name, r.points])).toEqual([
      ["Ben", 3],
      ["Ana", 2],
      ["Cy", 0],
    ]);
  });
  it("weeks start on Monday (UTC)", () => {
    expect(weekStart("2026-10-24")).toBe("2026-10-19");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
  });
});
