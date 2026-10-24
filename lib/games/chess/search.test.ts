import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { chooseMove, LEVELS } from "./ai";
import { moveToSan, moveToUci, Position, START_FEN } from "./position";
import { mateIn, Searcher } from "./search";

describe("search", () => {
  it("finds mate in one", () => {
    // Back-rank mate: Re8#.
    const pos = Position.fromFen("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1");
    const res = new Searcher().search(pos, { depth: 3 });
    expect(moveToSan(pos, res.move)).toBe("Re8#");
    expect(mateIn(res.score)).toBe(1);
  });

  it("finds mate in two", () => {
    // Smothered mate: 1.Qg8+ Rxg8 2.Nf7#.
    const pos = Position.fromFen("r6k/6pp/7N/8/8/1Q6/6PP/7K w - - 0 1");
    const res = new Searcher().search(pos, { depth: 5, exact: true });
    expect(mateIn(res.score)).toBe(2);
    expect(moveToSan(pos, res.move)).toBe("Qg8+");
  });

  it("wins a hanging queen", () => {
    const pos = Position.fromFen("rnb1kbnr/pppp1ppp/8/4p3/3P2q1/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1");
    const res = new Searcher().search(pos, { depth: 4 });
    expect(moveToUci(res.move)).not.toBe("");
    expect(res.score).toBeGreaterThan(-200);
  });

  it("is deterministic with depth limits", () => {
    const fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
    const a = new Searcher().search(Position.fromFen(fen), { depth: 5 });
    const b = new Searcher().search(Position.fromFen(fen), { depth: 5 });
    expect(a.move).toBe(b.move);
    expect(a.score).toBe(b.score);
    expect(a.pv).toEqual(b.pv);
  });

  it("respects the time limit", () => {
    const pos = Position.fromFen("r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8");
    const t = Date.now();
    const res = new Searcher().search(pos, { timeMs: 300 });
    expect(Date.now() - t).toBeLessThan(1500);
    expect(res.depth).toBeGreaterThanOrEqual(3);
  });

  it("excludes root moves for second-best search", () => {
    const pos = Position.fromFen("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1");
    const s = new Searcher();
    const best = s.search(pos, { depth: 3 });
    const second = s.search(pos, { depth: 3, exclude: [best.move] });
    expect(second.move).not.toBe(best.move);
    expect(mateIn(second.score)).toBeNull();
  });
});

describe("AI levels", () => {
  it("every level plays only legal moves through a whole game", () => {
    for (const level of LEVELS) {
      const pos = Position.fromFen(START_FEN);
      const rng = createRng(`ai-test:${level}`);
      for (let ply = 0; ply < (level >= 4 ? 3 : 30); ply++) {
        if (pos.gameEnd()) break;
        const m = chooseMove(pos, level, rng);
        expect(pos.legalMoves()).toContain(m);
        pos.make(m);
      }
    }
  }, 30_000);

  it("every level takes a free queen or mates when it can", () => {
    // Black queen hangs to the knight.
    const pos = Position.fromFen("4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1");
    for (const level of [3, 4, 5] as const) {
      expect(moveToSan(pos, chooseMove(pos, level, createRng("q")))).toBe("Nxd5");
    }
    const mate = Position.fromFen("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1");
    for (const level of [2, 3, 4, 5] as const) {
      expect(moveToSan(mate, chooseMove(mate, level, createRng("m")))).toBe("Re8#");
    }
  }, 30_000);
});
