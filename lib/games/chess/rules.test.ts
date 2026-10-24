import { describe, expect, it } from "vitest";
import { boardArray, captured, legalUiMoves, replay, sanList, status } from "./game";
import { moveToSan, Position, sanToMove, START_FEN, uciToMove } from "./position";

const play = (fen: string, sans: string[]) => {
  const pos = Position.fromFen(fen);
  for (const s of sans) {
    const m = sanToMove(pos, s);
    if (!m) throw new Error(`illegal ${s} in ${pos.toFen()}`);
    pos.make(m);
  }
  return pos;
};

describe("FEN", () => {
  it("round-trips", () => {
    for (const fen of [
      START_FEN,
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
      "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
      "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    ]) {
      expect(Position.fromFen(fen).toFen()).toBe(fen);
    }
  });

  it("drops an en passant square no pawn can use", () => {
    expect(play(START_FEN, ["e4"]).toFen()).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    expect(play(START_FEN, ["e4", "a6", "e5", "d5"]).toFen()).toBe("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
  });

  it("rejects malformed FEN", () => {
    expect(() => Position.fromFen("8/8/8 w - - 0 1")).toThrow();
    expect(() => Position.fromFen("8/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
  });
});

describe("special moves", () => {
  it("castles both ways and updates rights", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    let pos = play(fen, ["O-O"]);
    expect(pos.toFen()).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
    pos = play(fen, ["O-O-O", "O-O"]);
    expect(pos.toFen()).toBe("r4rk1/8/8/8/8/8/8/2KR3R w - - 2 2");
    // A rook move costs that side's right only.
    expect(play(fen, ["Rb1"]).toFen()).toContain(" Kkq ");
  });

  it("can't castle out of, through or into check", () => {
    const sans = (fen: string) => legalUiMoves(Position.fromFen(fen)).map((m) => m.san);
    expect(sans("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")).toEqual(expect.arrayContaining(["O-O", "O-O-O"]));
    expect(sans("r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1")).not.toContain("O-O"); // in check
    expect(sans("r3k2r/8/8/8/5r2/8/8/R3K2R w KQkq - 0 1")).not.toContain("O-O"); // f1 attacked
    expect(sans("r3k2r/8/8/8/6r1/8/8/R3K2R w KQkq - 0 1")).not.toContain("O-O"); // g1 attacked
    // b1 attacked doesn't stop queenside castling (the king never crosses it).
    expect(sans("r3k2r/8/8/8/1r6/8/8/R3K2R w KQkq - 0 1")).toContain("O-O-O");
  });

  it("captures en passant, and not when it would expose the king", () => {
    const pos = play(START_FEN, ["e4", "a6", "e5", "d5", "exd6"]);
    expect(pos.toFen()).toBe("rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3");
    // White king and black rook on the 5th rank: exd6 would expose the king.
    const pinned = Position.fromFen("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
    expect(legalUiMoves(pinned).map((m) => m.san)).not.toContain("exd6");
  });

  it("promotes to any piece, with SAN", () => {
    const pos = Position.fromFen("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    const sans = legalUiMoves(pos).map((m) => m.san);
    expect(sans).toEqual(expect.arrayContaining(["a8=Q", "a8=R", "a8=B", "a8=N"]));
    expect(play("8/P6k/8/8/8/8/8/K7 w - - 0 1", ["a8=N"]).toFen()).toBe("N7/7k/8/8/8/8/8/K7 b - - 0 1");
  });
});

describe("SAN", () => {
  it("disambiguates by file, rank or both", () => {
    const pos = Position.fromFen("4k3/8/8/8/8/8/8/R4RK1 w - - 0 1");
    expect(moveToSan(pos, uciToMove(pos, "a1d1"))).toBe("Rad1");
    const ranks = Position.fromFen("4k3/8/8/R7/8/8/8/R3K3 w Q - 0 1");
    expect(moveToSan(ranks, uciToMove(ranks, "a1a3"))).toBe("R1a3");
    const both = Position.fromFen("7k/8/8/8/2Q1Q3/8/2Q5/4K3 w - - 0 1");
    expect(moveToSan(both, uciToMove(both, "c4d3"))).toBe("Qc4d3");
  });

  it("marks check and mate", () => {
    expect(sanList(START_FEN, ["f2f3", "e7e5", "g2g4", "d8h4"])).toEqual(["f3", "e5", "g4", "Qh4#"]);
    const pos = play(START_FEN, ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]);
    expect(moveToSan(pos, uciToMove(pos, "h5f7"))).toBe("Qxf7#");
  });

  it("parses loose SAN", () => {
    expect(play("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", ["0-0"]).toFen()).toContain("R4RK1");
    expect(play("8/P6k/8/8/8/8/8/K7 w - - 0 1", ["a8Q+"]).toFen()).toContain("Q7");
  });
});

describe("game end", () => {
  it("checkmate", () => {
    const pos = replay(START_FEN, ["f2f3", "e7e5", "g2g4", "d8h4"]);
    expect(status(pos)).toMatchObject({ end: "checkmate", winner: "b", check: true });
  });

  it("stalemate", () => {
    expect(status(Position.fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toMatchObject({ end: "stalemate", winner: null });
  });

  it("50-move rule", () => {
    expect(status(Position.fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 100 80")).end).toBe("fifty-move");
    expect(status(Position.fromFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 80")).end).toBeNull();
  });

  it("threefold repetition", () => {
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    expect(status(replay(START_FEN, shuffle)).end).toBeNull();
    expect(status(replay(START_FEN, [...shuffle, ...shuffle])).end).toBe("threefold");
  });

  it("insufficient material", () => {
    for (const fen of ["8/8/4k3/8/8/3K4/8/8 w - - 0 1", "8/8/4k3/8/8/3KN3/8/8 w - - 0 1", "8/8/4kb2/8/8/3KB3/8/8 w - - 0 1"]) {
      expect(status(Position.fromFen(fen)).end).toBe("insufficient");
    }
    // Opposite-colored bishops or two knights can still (help)mate.
    expect(status(Position.fromFen("8/8/4k1b1/8/8/3KB3/8/8 w - - 0 1")).end).toBeNull();
    expect(status(Position.fromFen("8/8/4k3/8/8/3KNN2/8/8 w - - 0 1")).end).toBeNull();
    expect(status(Position.fromFen("8/8/4k3/8/8/3K4/4P3/8 w - - 0 1")).end).toBeNull();
  });
});

describe("UI helpers", () => {
  it("board array, legal moves and captured pieces", () => {
    const pos = replay(START_FEN, ["e2e4", "d7d5", "e4d5"]);
    const board = boardArray(pos);
    expect(board[0]).toBe("wR");
    expect(board[35]).toBe("wP"); // d5
    expect(board[60]).toBe("bK");
    expect(legalUiMoves(Position.fromFen(START_FEN))).toHaveLength(20);
    expect(captured(pos)).toEqual({ w: [], b: ["bP"] });
  });

  it("rejects illegal replays", () => {
    expect(() => replay(START_FEN, ["e2e5"])).toThrow();
  });
});
