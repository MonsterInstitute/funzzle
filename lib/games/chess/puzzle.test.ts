import { describe, expect, it } from "vitest";
import { replay } from "./game";
import { Position, uciToMove } from "./position";
import { FALLBACK, generatePuzzle, verifyPosition, type ChessPuzzle } from "./puzzle";
import { mateIn, Searcher } from "./search";
import { THEMES } from "./themes";

/** Independent check: score every alternative first move with its own search. */
function alternatives(p: ChessPuzzle): { best: number; others: number[] } {
  const pos = Position.fromFen(p.fen);
  const s = new Searcher();
  const depth = p.mate ? 2 * p.mate - 2 : 4;
  const scoreOf = (m: number) => {
    pos.make(m);
    const r = s.search(pos, { depth: Math.max(1, depth), exact: true });
    const score = pos.legalMoves().length ? -r.score : pos.inCheck() ? 32_000 : 0;
    pos.unmake();
    return score;
  };
  const solution = uciToMove(pos, p.solution[0]);
  return { best: scoreOf(solution), others: pos.legalMoves().filter((m) => m !== solution).map(scoreOf) };
}

function checkPuzzle(p: ChessPuzzle) {
  // The line is legal, alternates sides, and ends on the solver's move.
  expect(p.solution.length % 2).toBe(1);
  expect(p.san).toHaveLength(p.solution.length);
  const end = replay(p.fen, p.solution);
  const solver = Position.fromFen(p.fen).side;
  for (const t of p.themes) expect(THEMES).toContain(t);
  expect(p.difficulty).toBe(["easy", "medium", "hard"][Math.min(3, Math.ceil(p.solution.length / 2)) - 1]);
  if (p.kind === "mate") {
    expect(end.hasLegalMove()).toBe(false);
    expect(end.inCheck()).toBe(true);
    expect(p.themes).toContain(`mate-in-${p.mate}`);
  } else {
    expect(p.gain).toBeGreaterThanOrEqual(3);
    expect(end.material(solver) - Position.fromFen(p.fen).material(solver)).toBeGreaterThanOrEqual(2);
  }
  // Unique: no other first move comes close.
  const { best, others } = alternatives(p);
  if (p.kind === "mate") {
    for (const o of others) expect(mateIn(o) ?? 0).toBeLessThanOrEqual(0);
  } else {
    for (const o of others) expect(o).toBeLessThanOrEqual(best - 200);
  }
}

describe("daily puzzle generation", () => {
  it("is deterministic and quick", () => {
    const t = Date.now();
    const a = generatePuzzle("chess:2026-10-15");
    const ms = Date.now() - t;
    expect(generatePuzzle("chess:2026-10-15")).toEqual(a);
    expect(ms).toBeLessThan(10_000);
  }, 30_000);

  for (const date of ["2026-10-06", "2026-10-16", "2026-10-24"]) {
    it(`${date}: a unique, verified tactic`, () => {
      const t = Date.now();
      const p = generatePuzzle(`chess:${date}`);
      expect(Date.now() - t).toBeLessThan(10_000);
      checkPuzzle(p);
    }, 60_000);
  }

  it("every fallback position is still a verified puzzle", () => {
    for (const fen of FALLBACK) {
      const p = verifyPosition(Position.fromFen(fen));
      expect(p, fen).not.toBeNull();
    }
  }, 60_000);

  it("rejects positions with two winning moves", () => {
    // Two different rooks can mate on the back rank.
    expect(verifyPosition(Position.fromFen("6k1/5ppp/8/8/8/8/1R3PPP/R5K1 w - - 0 1"))).toBeNull();
    // Quiet start position: no tactic at all.
    expect(verifyPosition(Position.fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))).toBeNull();
  }, 30_000);
});
