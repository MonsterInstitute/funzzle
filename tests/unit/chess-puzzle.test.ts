import { describe, expect, it } from "vitest";
import { goalLabel, isCorrect, mainTheme, moveSquares, puzzleHint, solverColor, solverMoves } from "@/components/chess/puzzleState";
import type { ChessPuzzle } from "@/lib/games/chess";

// Two rooks, mate in 2: 1.Rd8+ Rxd8 2.Rxd8# (the a-rook could also mate at the end? no: one rook left).
const mate: ChessPuzzle = {
  seed: "test",
  fen: "3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1",
  lastMove: null,
  solution: ["e1e8", "d8e8", "d1d8"],
  san: ["Re8+", "Rxe8", "Rd8#"],
  kind: "mate",
  mate: 2,
  gain: 0,
  difficulty: "medium",
  themes: ["back-rank", "mate-in-2"],
};

const fork: ChessPuzzle = {
  seed: "test2",
  fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1",
  lastMove: "a7a8",
  solution: ["b5c7", "e8d8", "c7a8"],
  san: ["Nc7+", "Kd8", "Nxa8"],
  kind: "material",
  mate: null,
  gain: 5,
  difficulty: "medium",
  themes: ["win-material", "fork"],
};

describe("chess puzzle play", () => {
  it("accepts the solution move and, on the last move of a mate, any mate", () => {
    expect(isCorrect(mate, 0, "e1e8")).toBe(true);
    expect(isCorrect(mate, 0, "d1d8")).toBe(false);
    expect(isCorrect(mate, 2, "d1d8")).toBe(true);
    // Not a mate: wrong.
    expect(isCorrect(mate, 2, "d1d2")).toBe(false);
    // Material puzzles only accept the line.
    expect(isCorrect(fork, 2, "c7e6")).toBe(false);
    expect(isCorrect(fork, 0, "b5c7")).toBe(true);
  });

  it("labels and counts", () => {
    expect(goalLabel(mate)).toBe("Mate in 2");
    expect(goalLabel(fork)).toBe("Win material");
    expect(solverMoves(mate)).toBe(2);
    expect(solverColor(fork)).toBe("w");
    expect(mainTheme(fork)).toBe("fork");
    expect(mainTheme(mate)).toBe("back-rank");
    expect(moveSquares("e2e4")).toEqual({ from: 12, to: 28 });
  });

  it("coach ladder: piece, idea, move", () => {
    expect(puzzleHint(fork, 0, 1)).toEqual({ text: "Look at your knight on b5.", squares: { from: 33 } });
    expect(puzzleHint(fork, 0, 2).text).toMatch(/fork.*It’s a check/);
    expect(puzzleHint(fork, 0, 3)).toEqual({ text: "Play Nc7+: your knight from b5 to c7.", squares: { from: 33, to: 50 } });
    expect(puzzleHint(mate, 0, 2).text).toMatch(/forced mate in 2/);
    expect(puzzleHint(mate, 2, 2).text).toMatch(/One move ends the game. It’s checkmate/);
  });
});
