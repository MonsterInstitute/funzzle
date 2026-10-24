import { beforeEach, describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import {
  applyMove,
  bestMove,
  dailyDeal,
  deal,
  describeMove,
  isLegal,
  isWon,
  knownLine,
  legalMoves,
  rememberWinningLine,
  type State,
} from "./index";
import { clearKnownLines } from "./solver";
import { build } from "./test-helpers";

beforeEach(() => clearKnownLines());

/** One sentence: ends with a full stop and has no sentence break inside. */
const oneSentence = (text: string) => text.endsWith(".") && !text.slice(0, -1).includes(". ");

describe("describeMove", () => {
  it("names the cards involved", () => {
    const s = build({ tableau: ["9C 8D 7S", "8H", "AH", ""], cells: ["7C"] });
    expect(describeMove(s, { kind: "cell-to-tableau", cell: 0, to: 1 })).toBe("Move the 7♣ from its free cell onto the 8♥");
    expect(describeMove(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 1 })).toBe("Move the 7♠ onto the 8♥");
    expect(describeMove(s, { kind: "tableau-to-tableau", from: 0, to: 3, count: 3 })).toBe(
      "Move the 9♣ to 7♠ run to empty column 4",
    );
    expect(describeMove(s, { kind: "tableau-to-foundation", from: 2 })).toBe("Move the A♥ to its foundation");
    expect(describeMove(s, { kind: "tableau-to-cell", from: 0, cell: 1 })).toBe("Move the 7♠ to a free cell");
  });
});

describe("bestMove heuristics", () => {
  it("sends a card home first", () => {
    const hint = bestMove(build({ tableau: ["9S AH", "KD"] }), { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "tableau-to-foundation", from: 0 });
    expect(hint.reason).toBe("foundation");
    expect(hint.winning).toBe(false);
    expect(hint.text).toBe("Aces and twos are never needed in the tableau, so send them home right away.");
  });

  it("uncovers a card that can go home", () => {
    const hint = bestMove(build({ tableau: ["9S 2H 7C", "8H", "KS QS JS"], foundations: [0, 1, 0, 0] }), {
      maxNodes: 1,
    })!;
    expect(hint.move).toEqual({ kind: "tableau-to-tableau", from: 0, to: 1, count: 1 });
    expect(hint.reason).toBe("free-low");
    expect(hint.text).toBe("It uncovers the 2♥, which can go straight to its foundation.");
  });

  it("empties a column", () => {
    const hint = bestMove(build({ tableau: ["7C", "8H", "KS QS JS", "KD QD"], cells: ["JC", "10C", "9C", "QC"] }), {
      maxNodes: 1,
    })!;
    expect(hint.move).toEqual({ kind: "tableau-to-tableau", from: 0, to: 1, count: 1 });
    expect(hint.reason).toBe("empty-column");
    expect(hint.text).toMatch(/empties column 1/);
  });

  it("takes a card out of a free cell rather than filling one", () => {
    const hint = bestMove(build({ tableau: ["KS QS JS", "8H", "KD QD JD", "KC QC JC", "KH QH JH"], cells: ["7C"] }), {
      maxNodes: 1,
    })!;
    expect(hint.move).toEqual({ kind: "cell-to-tableau", cell: 0, to: 1 });
    expect(hint.reason).toBe("free-cell");
  });

  it("digs toward a buried Ace", () => {
    const hint = bestMove(build({ tableau: ["AC 9D 7S", "8H", "KS QS JS", "KD QD JD", "KH QH JH"] }), { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "tableau-to-tableau", from: 0, to: 1, count: 1 });
    expect(hint.reason).toBe("dig");
    expect(hint.text).toBe("It digs toward the A♣ in column 1, which unlocks the whole club suit.");
  });

  it("returns null when the game is won", () => {
    expect(bestMove(build({ foundations: [13, 13, 13, 13] }))).toBeNull();
  });
});

describe("bestMove", () => {
  it("always returns a legal move with a one-sentence reason from mid-game positions", () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng(`coach:${g}`);
      let s: State = deal(`coach:${g}`);
      for (let step = 0; step < 10 + g * 3; step++) {
        const moves = legalMoves(s);
        if (!moves.length) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
      }
      for (const opts of [{ maxNodes: 20_000 }, { maxNodes: 1 }]) {
        clearKnownLines();
        const hint = bestMove(s, opts);
        if (!hint) continue;
        expect(isLegal(s, hint.move)).toBe(true);
        expect(oneSentence(hint.text)).toBe(true);
        expect(hint.text.length).toBeLessThan(110);
      }
    }
  }, 60_000);

  it("following the coach from a daily deal wins the game", () => {
    for (const date of ["2026-10-24", "2026-10-25", "2027-01-01"]) {
      const { state } = dailyDeal(date);
      let s = state;
      for (let step = 0; step < 500 && !isWon(s); step++) {
        const hint = bestMove(s)!;
        expect(hint.winning).toBe(true);
        expect(oneSentence(hint.text)).toBe(true);
        s = applyMove(s, hint.move);
      }
      expect(isWon(s)).toBe(true);
    }
  }, 30_000);

  it("uses a remembered line and rejects a wrong one", () => {
    const { state, solution } = dailyDeal("2026-11-11");
    clearKnownLines();
    expect(rememberWinningLine(state, solution.slice(0, -1))).toBe(false);
    expect(knownLine(state)).toBeUndefined();
    expect(rememberWinningLine(state, solution)).toBe(true);
    expect(knownLine(state)).toEqual(solution);
    const hint = bestMove(state, { maxNodes: 1 })!;
    expect(hint.move).toEqual(solution[0]);
    expect(hint.winning).toBe(true);
  });

  it("finds a winning line by itself without a remembered one", () => {
    const { state } = dailyDeal("2026-10-26");
    clearKnownLines();
    const hint = bestMove(state)!;
    expect(hint.winning).toBe(true);
    expect(isLegal(state, hint.move)).toBe(true);
  });
});
