import { describe, expect, it } from "vitest";
import { analyse } from "./ai";
import { explainMove } from "./coach";
import { handle } from "./worker";
import { Position, sanToMove, START_FEN } from "./position";
import { detectThemes } from "./themes";

const explain = (fen: string, san: string, score = 0) => {
  const pos = Position.fromFen(fen);
  return explainMove(pos, sanToMove(pos, san), score);
};

describe("coach", () => {
  it("explains mate", () => {
    const h = explain("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "Re8#", 31_999);
    expect(h.reason).toBe("mate");
    expect(h.text).toMatch(/^Play Re8#/);
    expect(h.why[0]).toMatch(/checkmate/);
  });

  it("explains a free capture", () => {
    const h = explain("4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1", "Nxd5", 900);
    expect(h.reason).toBe("capture");
    expect(h.why.join(" ")).toMatch(/wins the queen on d5 for free/);
  });

  it("explains a fork", () => {
    const h = explain("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Nc7+", 500);
    expect(h.why.join(" ")).toMatch(/fork/);
    expect(h.why.join(" ")).toMatch(/king/);
  });

  it("explains castling and development", () => {
    expect(explain("r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", "O-O").reason).toBe("castle");
    expect(explain(START_FEN, "Nf3").reason).toBe("develop");
    expect(explain(START_FEN, "e4").reason).toBe("centre");
  });

  it("explains its own best move in a sharp middlegame", () => {
    const fen = "r1b1k2r/pppp1ppp/2n5/2b1p3/2B1P2q/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1";
    const pos = Position.fromFen(fen);
    const best = analyse(pos, 300);
    const h = explainMove(pos, best.move, best.score);
    expect(h.why.length).toBeGreaterThan(0);
    expect(h.san).toBeTruthy();
  });

  it("answers worker requests", () => {
    const move = handle({ id: 1, type: "move", fen: START_FEN, moves: ["e2e4"], level: 3, seed: "t" });
    expect(typeof move).toBe("string");
    const hint = handle({ id: 2, type: "hint", fen: START_FEN, moves: [], timeMs: 200 }) as { san: string };
    expect(hint.san).toBeTruthy();
  });
});

describe("themes", () => {
  it("fork", () => {
    expect(detectThemes("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", ["b5c7", "e8d8", "c7a8"], null)).toEqual(["win-material", "fork"]);
  });

  it("back-rank mate in one", () => {
    expect(detectThemes("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", ["e1e8"], 1)).toEqual(["mate-in-1", "back-rank"]);
  });

  it("pin", () => {
    // Bb5 pins the knight on c6 to the king on e8.
    expect(detectThemes("4k3/8/2n5/8/8/8/8/3BK3 w - - 0 1", ["d1a4"], null)).toContain("pin");
  });

  it("skewer", () => {
    // Rook check on the 8th rank; the queen behind the king falls.
    expect(detectThemes("1q2k3/8/8/8/8/8/8/4K2R w - - 0 1", ["h1h8", "e8d7", "h8b8"], null)).toContain("skewer");
  });

  it("discovered attack", () => {
    // The bishop moves off the e-file with check, unmasking the rook on the queen.
    expect(detectThemes("4q1k1/8/8/8/4B3/8/8/4R1K1 w - - 0 1", ["e4d5", "g8h8", "e1e8"], null)).toContain("discovered-attack");
  });
});
