import { describe, expect, it } from "vitest";
import { bestMove, coachPlay, legalMoves, maxTile, newGame, type State, type Tile } from "./index";

function stateOf(cells: number[], seed = "test"): State {
  const tiles: Tile[] = [];
  cells.forEach((v, cell) => v && tiles.push({ id: tiles.length + 1, v, cell, born: 0 }));
  return { seed, tiles, nextId: tiles.length + 1, score: 0, moves: 0 };
}

describe("2048 coach", () => {
  it("only suggests moves that change the board", () => {
    let s = newGame("coach-legal");
    for (let i = 0; i < 60; i++) {
      const h = bestMove(s)!;
      expect(legalMoves(s)).toContain(h.dir);
      expect(h.text.startsWith("Slide ")).toBe(true);
      s = coachPlay(s, 1);
    }
  });

  it("returns null when the game is over", () => {
    expect(bestMove(stateOf([1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]))).toBeNull();
  });

  it("says when there is only one move", () => {
    // Only "down"/"up" can't work on a full first column; build a board where only left moves.
    const cells = [0, 5, 4, 3, 0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1];
    const s = stateOf(cells);
    expect(legalMoves(s)).toEqual(["left"]);
    expect(bestMove(s)!.reason).toBe("only");
  });

  it("merges big tiles into the corner instead of pulling them out", () => {
    // 256 256 in the top row, biggest in the top-left corner: slide left.
    const cells = [8, 8, 2, 1, 4, 3, 1, 0, 2, 1, 0, 0, 1, 0, 0, 0];
    const h = bestMove(stateOf(cells))!;
    expect(h.dir).toBe("left");
    expect(h.reason).toBe("merge-big");
  });

  it("keeps the biggest tile in its corner", () => {
    // 512 in the bottom-left; sliding up would drag it out of its corner.
    const cells = [0, 0, 0, 0, 1, 0, 0, 0, 3, 2, 0, 0, 9, 7, 5, 1];
    const h = bestMove(stateOf(cells))!;
    expect(h.dir).not.toBe("up");
  });

  it("plays well enough to teach: self-play reaches 512 on most seeds", { timeout: 120_000 }, () => {
    const results: { score: number; max: number; ms: number }[] = [];
    for (const seed of ["s1", "s2", "s3"]) {
      const t0 = performance.now();
      const end = coachPlay(newGame(`selfplay:${seed}`), 700);
      results.push({ score: end.score, max: 2 ** maxTile(end), ms: (performance.now() - t0) / Math.max(1, end.moves) });
    }
    // Timing and strength, printed for the report.
    console.log("coach self-play (700 moves max):", JSON.stringify(results));
    expect(results.filter((r) => r.max >= 512).length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...results.map((r) => r.ms))).toBeLessThan(60);
  });
});
