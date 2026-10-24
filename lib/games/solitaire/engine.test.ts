import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import {
  applyMove,
  autoFinish,
  canAutoFinish,
  cardLabel,
  deal,
  isLegal,
  isWon,
  legalMoves,
  type Move,
  type State,
} from "./index";
import { allCards, build, c, replay } from "./test-helpers";

const ALL = Array.from({ length: 52 }, (_, i) => i);

describe("deal", () => {
  it("is deterministic per seed and draw mode", () => {
    expect(deal("abc")).toEqual(deal("abc"));
    expect(deal("abc", 3).stock).toEqual(deal("abc", 3).stock);
    expect(deal("abc")).not.toEqual(deal("abd"));
  });

  it("uses all 52 cards once with the standard layout", () => {
    for (const seed of ["a", "b", "solitaire:2026-10-24:1:0"]) {
      const s = deal(seed);
      expect(allCards(s)).toEqual(ALL);
      expect(s.stock).toHaveLength(24);
      expect(s.waste).toHaveLength(0);
      s.tableau.forEach((col, i) => {
        expect(col.down).toHaveLength(i);
        expect(col.up).toHaveLength(1);
      });
      expect(s).toMatchObject({ draw: 1, recycles: 0, score: 0, moves: 0 });
      for (const card of allCards(s)) expect(card).toBeGreaterThanOrEqual(0);
    }
    expect(deal("x", 3).draw).toBe(3);
  });
});

describe("cardLabel", () => {
  it("formats rank and suit", () => {
    expect(cardLabel(c("7C"))).toBe("7♣");
    expect(cardLabel(c("10H"))).toBe("10♥");
    expect(cardLabel(c("KS"))).toBe("K♠");
    expect(cardLabel(c("AD"))).toBe("A♦");
  });
});

describe("draw and recycle", () => {
  it("draw 1 moves the top stock card to the waste", () => {
    const s = build({ stock: "2C 3D 4H" });
    const t = applyMove(s, { kind: "draw" });
    expect(t.waste.map(cardLabel)).toEqual(["4♥"]);
    expect(t.stock.map(cardLabel)).toEqual(["2♣", "3♦"]);
    expect(t.moves).toBe(1);
    expect(t.score).toBe(0);
    expect(s.stock).toHaveLength(3); // original untouched
  });

  it("draw 3 turns over three cards, or what is left", () => {
    const s = build({ stock: "2C 3D 4H 5S 6S", draw: 3 });
    const t = applyMove(s, { kind: "draw" });
    expect(t.waste.map(cardLabel)).toEqual(["6♠", "5♠", "4♥"]);
    const u = applyMove(t, { kind: "draw" });
    expect(u.waste.map(cardLabel)).toEqual(["6♠", "5♠", "4♥", "3♦", "2♣"]);
    expect(u.stock).toHaveLength(0);
    expect(isLegal(u, { kind: "draw" })).toBe(false);
  });

  it("recycle restores the stock order and costs points", () => {
    let s = build({ stock: "2C 3D 4H", score: 150 });
    expect(isLegal(s, { kind: "recycle" })).toBe(false);
    for (let i = 0; i < 3; i++) s = applyMove(s, { kind: "draw" });
    expect(isLegal(s, { kind: "draw" })).toBe(false);
    const t = applyMove(s, { kind: "recycle" });
    expect(t.stock.map(cardLabel)).toEqual(["2♣", "3♦", "4♥"]);
    expect(t.waste).toHaveLength(0);
    expect(t.recycles).toBe(1);
    expect(t.score).toBe(50);
    expect(applyMove(applyMove(applyMove(applyMove(t, { kind: "draw" }), { kind: "draw" }), { kind: "draw" }), { kind: "recycle" }).score).toBe(0);
    expect(isLegal(build({}), { kind: "recycle" })).toBe(false);
  });

  it("recycle in draw 3 costs 20", () => {
    const s = build({ waste: "2C", draw: 3, score: 30 });
    expect(applyMove(s, { kind: "recycle" }).score).toBe(10);
  });
});

describe("waste moves", () => {
  it("waste to foundation", () => {
    const s = build({ waste: "AH" });
    const t = applyMove(s, { kind: "waste-to-foundation" });
    expect(t.foundations[1].map(cardLabel)).toEqual(["A♥"]);
    expect(t.score).toBe(10);
    expect(isLegal(build({ waste: "2H" }), { kind: "waste-to-foundation" })).toBe(false);
    expect(isLegal(build({ waste: "2H", foundations: [0, 1, 0, 0] }), { kind: "waste-to-foundation" })).toBe(true);
    expect(isLegal(build({}), { kind: "waste-to-foundation" })).toBe(false);
  });

  it("waste to tableau needs alternating colour one rank lower, or a King on empty", () => {
    const s = build({ waste: "7C", tableau: ["|8H", "|8S", "|", "|9D"] });
    expect(isLegal(s, { kind: "waste-to-tableau", to: 0 })).toBe(true);
    expect(isLegal(s, { kind: "waste-to-tableau", to: 1 })).toBe(false);
    expect(isLegal(s, { kind: "waste-to-tableau", to: 2 })).toBe(false);
    expect(isLegal(s, { kind: "waste-to-tableau", to: 3 })).toBe(false);
    expect(isLegal(s, { kind: "waste-to-tableau", to: 7 })).toBe(false);
    const t = applyMove(s, { kind: "waste-to-tableau", to: 0 });
    expect(t.tableau[0].up.map(cardLabel)).toEqual(["8♥", "7♣"]);
    expect(t.score).toBe(5);
    expect(isLegal(build({ waste: "KD" }), { kind: "waste-to-tableau", to: 4 })).toBe(true);
  });
});

describe("tableau moves", () => {
  it("tableau to foundation turns over the next card", () => {
    const s = build({ tableau: ["5D 9C|AS"] });
    const t = applyMove(s, { kind: "tableau-to-foundation", from: 0 });
    expect(t.tableau[0].down.map(cardLabel)).toEqual(["5♦"]);
    expect(t.tableau[0].up.map(cardLabel)).toEqual(["9♣"]);
    expect(t.score).toBe(15);
    expect(isLegal(s, { kind: "tableau-to-foundation", from: 1 })).toBe(false);
    expect(isLegal(build({ tableau: ["|2S"] }), { kind: "tableau-to-foundation", from: 0 })).toBe(false);
  });

  it("moves runs between columns", () => {
    const s = build({ tableau: ["4D|9H 8C 7H", "|10S", "|9S", "|"] });
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 3 })).toBe(true);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 2 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 2, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 0, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 4 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 0 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 3, count: 3 })).toBe(false);
    const t = applyMove(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 3 });
    expect(t.tableau[1].up.map(cardLabel)).toEqual(["10♠", "9♥", "8♣", "7♥"]);
    expect(t.tableau[0].up.map(cardLabel)).toEqual(["4♦"]);
    expect(t.tableau[0].down).toHaveLength(0);
    expect(t.score).toBe(5);
    expect(t.moves).toBe(1);
  });

  it("partial runs move without turning anything over", () => {
    const s = build({ tableau: ["4D|9H 8C 7H", "|9D"] });
    const t = applyMove(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 2 });
    expect(t.tableau[0].up.map(cardLabel)).toEqual(["9♥"]);
    expect(t.tableau[1].up.map(cardLabel)).toEqual(["9♦", "8♣", "7♥"]);
    expect(t.score).toBe(0);
  });

  it("only a King-led run may go to an empty column", () => {
    const s = build({ tableau: ["2C|KH QS", "|", "|QD"] });
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 2 })).toBe(true);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 2, to: 1, count: 1 })).toBe(false);
  });

  it("foundation to tableau costs 15 points, never below zero", () => {
    const s = build({ foundations: [0, 6, 0, 0], tableau: ["|7S", "|7D"], score: 20 });
    const move: Move = { kind: "foundation-to-tableau", suit: "H", to: 0 };
    expect(isLegal(s, move)).toBe(true);
    expect(isLegal(s, { kind: "foundation-to-tableau", suit: "H", to: 1 })).toBe(false);
    expect(isLegal(s, { kind: "foundation-to-tableau", suit: "S", to: 1 })).toBe(false);
    const t = applyMove(s, move);
    expect(t.foundations[1]).toHaveLength(5);
    expect(t.tableau[0].up.map(cardLabel)).toEqual(["7♠", "6♥"]);
    expect(t.score).toBe(5);
    expect(applyMove({ ...s, score: 3 }, move).score).toBe(0);
  });

  it("applyMove throws on illegal moves", () => {
    expect(() => applyMove(build({}), { kind: "draw" })).toThrow(/Illegal/);
    expect(() => applyMove(build({}), { kind: "tableau-to-foundation", from: 9 })).toThrow();
  });
});

describe("random play", () => {
  it("legalMoves are all legal and the deck is conserved", () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng(`play:${g}`);
      let s: State = deal(`play:${g}`, g % 2 ? 3 : 1);
      for (let step = 0; step < 300; step++) {
        const moves = legalMoves(s);
        for (const m of moves) expect(isLegal(s, m)).toBe(true);
        if (moves.length === 0) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
        expect(allCards(s)).toEqual(ALL);
        expect(s.moves).toBe(step + 1);
        expect(s.score).toBeGreaterThanOrEqual(0);
        for (const col of s.tableau) if (col.down.length) expect(col.up.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("autoFinish", () => {
  const open = build({
    foundations: [9, 9, 9, 10],
    tableau: ["|KS QH JS 10H", "|KD QC", "|KH QS JH 10S", "|KC QD JC 10D", "|JD"],
  });

  it("finishes a fully open position", () => {
    expect(canAutoFinish(open)).toBe(true);
    const moves = autoFinish(open);
    expect(moves).toHaveLength(15);
    expect(moves.every((m) => m.kind === "tableau-to-foundation")).toBe(true);
    expect(isWon(replay(open, moves))).toBe(true);
  });

  it("refuses while cards are hidden or in the stock", () => {
    expect(canAutoFinish(build({ foundations: [11, 13, 13, 13], tableau: ["KS|QS"] }))).toBe(false);
    expect(canAutoFinish(build({ foundations: [12, 13, 13, 13], waste: "KS" }))).toBe(false);
    expect(autoFinish(build({ foundations: [12, 13, 13, 13], stock: "KS" }))).toEqual([]);
  });

  it("is not offered on a won game", () => {
    const won = build({ foundations: [13, 13, 13, 13] });
    expect(isWon(won)).toBe(true);
    expect(canAutoFinish(won)).toBe(false);
  });
});
