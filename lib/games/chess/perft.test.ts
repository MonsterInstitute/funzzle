import { describe, expect, it } from "vitest";
import { perft, Position, START_FEN } from "./position";

// Standard perft positions (chessprogramming.org/Perft_Results).
const CASES: [name: string, fen: string, depth: number, nodes: number][] = [
  ["start", START_FEN, 4, 197_281],
  ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3, 97_862],
  ["position 3", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 5, 674_624],
  ["position 4", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 4, 422_333],
  ["position 5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 3, 62_379],
];

describe("perft", () => {
  for (const [name, fen, depth, nodes] of CASES) {
    it(`${name} depth ${depth} = ${nodes}`, () => {
      const pos = Position.fromFen(fen);
      expect(perft(pos, depth)).toBe(nodes);
      // make/unmake leaves the position untouched.
      expect(pos.toFen()).toBe(Position.fromFen(fen).toFen());
    });
  }
});
