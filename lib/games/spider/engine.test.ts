import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import {
  applyMove,
  canDeal,
  cardLabel,
  deal,
  isLegal,
  isWon,
  legalMoves,
  movableRun,
  positionKey,
  type Card,
  type State,
} from "./index";
import { allCards, build, replay, run } from "./test-helpers";

const ALL = Array.from({ length: 104 }, (_, i) => i);
const labels = (cards: Card[]) => cards.map(cardLabel);

describe("deal", () => {
  it("is deterministic per seed and suit count", () => {
    expect(deal("abc", 2)).toEqual(deal("abc", 2));
    expect(deal("abc", 2)).not.toEqual(deal("abd", 2));
    expect(deal("abc", 1)).not.toEqual(deal("abc", 4));
  });

  it("uses all 104 cards once with the standard layout", () => {
    for (const suits of [1, 2, 4] as const) {
      const s = deal(`layout:${suits}`, suits);
      expect(allCards(s)).toEqual(ALL);
      expect(s.stock).toHaveLength(50);
      expect(s.foundations).toHaveLength(0);
      s.tableau.forEach((col, i) => {
        expect(col.down).toHaveLength(i < 4 ? 5 : 4);
        expect(col.up).toHaveLength(1);
      });
      expect(s).toMatchObject({ suits, score: 500, moves: 0 });
    }
  });

  it("fills the shoe with the right suits", () => {
    const count = (s: State) => {
      const n: Record<string, number> = {};
      for (const c of [...s.stock, ...s.tableau.flatMap((col) => [...col.down, ...col.up])]) n[c.suit] = (n[c.suit] ?? 0) + 1;
      return n;
    };
    expect(count(deal("x", 1))).toEqual({ S: 104 });
    expect(count(deal("x", 2))).toEqual({ S: 52, H: 52 });
    expect(count(deal("x", 4))).toEqual({ S: 26, H: 26, D: 26, C: 26 });
  });

  it("is plain JSON", () => {
    const s = deal("json", 4);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const t = applyMove(s, legalMoves(s)[0]);
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe("moves", () => {
  it("movableRun counts the same-suit descending run on top", () => {
    const s = build({ tableau: ["|9S 8H 7H 6H", "|5S 4S 3D", "|", "|2C"] });
    expect(s.tableau.map(movableRun).slice(0, 4)).toEqual([3, 1, 0, 1]);
  });

  it("any card goes on one rank higher, whatever the suit", () => {
    const s = build({ tableau: ["4D|9H 8C", "|9S", "|10C", "|8D"] });
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 1 })).toBe(true);
    expect(isLegal(s, { kind: "move", from: 0, to: 2, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 3, count: 1 })).toBe(false);
    // 9♥ 8♣ is in order but mixed suits, so it does not move as one.
    expect(isLegal(s, { kind: "move", from: 0, to: 2, count: 2 })).toBe(false);
    const t = applyMove(s, { kind: "move", from: 0, to: 1, count: 1 });
    expect(labels(t.tableau[1].up)).toEqual(["9♠", "8♣"]);
    expect(labels(t.tableau[0].up)).toEqual(["9♥"]);
  });

  it("same-suit runs move together, also partly, and onto any suit", () => {
    const s = build({ tableau: ["|KC 8H 7H 6H", "|9S", "|7C", "|"] });
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 3 })).toBe(true);
    expect(isLegal(s, { kind: "move", from: 0, to: 2, count: 1 })).toBe(true);
    expect(isLegal(s, { kind: "move", from: 0, to: 2, count: 2 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 4 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 3, count: 2 })).toBe(true);
    const t = applyMove(s, { kind: "move", from: 0, to: 1, count: 3 });
    expect(labels(t.tableau[1].up)).toEqual(["9♠", "8♥", "7♥", "6♥"]);
    expect(labels(t.tableau[0].up)).toEqual(["K♣"]);
  });

  it("an empty column takes any card or run", () => {
    const s = build({ tableau: ["|5D", "|", "2C|"] });
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 1 })).toBe(true);
    // A column whose only cards are face down is not empty (only hand-made positions have one).
    expect(isLegal(s, { kind: "move", from: 0, to: 2, count: 1 })).toBe(false);
  });

  it("rejects bad columns and counts", () => {
    const s = build({ tableau: ["|5D", "|6D"] });
    expect(isLegal(s, { kind: "move", from: 0, to: 0, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 10, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: -1, to: 1, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 0 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 0, to: 1, count: 1.5 })).toBe(false);
    expect(isLegal(s, { kind: "move", from: 2, to: 1, count: 1 })).toBe(false);
    expect(() => applyMove(s, { kind: "move", from: 1, to: 0, count: 1 })).toThrow(/Illegal/);
  });

  it("turns over the next face-down card", () => {
    const s = build({ tableau: ["3H 9C|5D", "|6S"] });
    const t = applyMove(s, { kind: "move", from: 0, to: 1, count: 1 });
    expect(labels(t.tableau[0].down)).toEqual(["3♥"]);
    expect(labels(t.tableau[0].up)).toEqual(["9♣"]);
    expect(s.tableau[0].up).toHaveLength(1); // original untouched
  });
});

describe("completed runs", () => {
  it("a K-to-A run of one suit goes to the foundation", () => {
    const s = build({ tableau: ["4D|" + run("S", 13, 2), "|AS", "|3C"] });
    const t = applyMove(s, { kind: "move", from: 1, to: 0, count: 1 });
    expect(t.foundations).toHaveLength(1);
    expect(labels(t.foundations[0])).toEqual(run("S").replace(/S/g, "♠").split(" "));
    expect(labels(t.tableau[0].up)).toEqual(["4♦"]);
    expect(t.tableau[0].down).toHaveLength(0);
    expect(t.score).toBe(500 - 1 + 100);
  });

  it("a mixed-suit K-to-A sequence stays", () => {
    const s = build({ tableau: ["|" + run("S", 13, 2), "|AH"] });
    const t = applyMove(s, { kind: "move", from: 1, to: 0, count: 1 });
    expect(t.foundations).toHaveLength(0);
    expect(t.tableau[0].up).toHaveLength(13);
  });

  it("a deal can complete a run", () => {
    const tableau = ["|" + run("H", 13, 2), ...run("C", 12, 4).split(" ").map((x) => "|" + x)];
    const s = build({ tableau, stock: "2D 3D 4D 5D 6D 7D 8D 9D 10D AH" });
    const t = applyMove(s, { kind: "deal" });
    expect(t.foundations).toHaveLength(1);
    expect(t.tableau[0].up).toHaveLength(0);
    expect(t.score).toBe(599);
  });

  it("finishing the last run wins", () => {
    const s = build({ tableau: ["|" + run("C", 13, 2), "|AC"], foundations: "S S H H D D C" });
    expect(isWon(s)).toBe(false);
    const t = applyMove(s, { kind: "move", from: 1, to: 0, count: 1 });
    expect(isWon(t)).toBe(true);
    expect(legalMoves(t)).toEqual([]);
  });
});

describe("dealing from the stock", () => {
  const full = Array.from({ length: 10 }, (_, i) => `|${i + 2}S`.replace("11S", "JS"));

  it("puts one card face up on every column, column 1 first", () => {
    const s = build({ tableau: full, stock: "AH 2H 3H 4H 5H 6H 7H 8H 9H 10H KD" });
    const t = applyMove(s, { kind: "deal" });
    expect(t.tableau.map((c) => cardLabel(c.up[c.up.length - 1]))).toEqual([
      "K♦", "10♥", "9♥", "8♥", "7♥", "6♥", "5♥", "4♥", "3♥", "2♥",
    ]);
    expect(labels(t.stock)).toEqual(["A♥"]);
    expect(t.score).toBe(499);
    expect(t.moves).toBe(1);
  });

  it("is blocked while any column is empty", () => {
    const tableau = full.slice();
    tableau[6] = "|";
    const s = build({ tableau, stock: run("H", 10, 1) });
    expect(canDeal(s)).toBe(false);
    expect(isLegal(s, { kind: "deal" })).toBe(false);
    expect(legalMoves(s).some((m) => m.kind === "deal")).toBe(false);
    expect(() => applyMove(s, { kind: "deal" })).toThrow(/every column/);
    expect(canDeal(build({ tableau: full, stock: run("H", 10, 1) }))).toBe(true);
  });

  it("is impossible with an empty stock", () => {
    expect(isLegal(build({ tableau: full }), { kind: "deal" })).toBe(false);
  });
});

describe("scoring", () => {
  it("costs one point per move and never goes below zero", () => {
    const s = build({ tableau: ["|5D", "|6D", "|6S"] });
    const t = applyMove(s, { kind: "move", from: 0, to: 1, count: 1 });
    expect(t.score).toBe(499);
    const u = applyMove(t, { kind: "move", from: 1, to: 2, count: 1 });
    expect(u.score).toBe(498);
    expect(u.moves).toBe(2);
    expect(applyMove({ ...s, score: 0 }, { kind: "move", from: 0, to: 1, count: 1 }).score).toBe(0);
  });
});

describe("positionKey", () => {
  it("ignores score and move count", () => {
    const s = deal("key", 2);
    expect(positionKey({ ...s, score: 3, moves: 9 })).toBe(positionKey(s));
    expect(positionKey(applyMove(s, { kind: "deal" }))).not.toBe(positionKey(s));
  });
});

describe("random play", () => {
  it("legalMoves are all legal and the deck is conserved", () => {
    for (let g = 0; g < 24; g++) {
      const suits = ([1, 2, 4] as const)[g % 3];
      const rng = createRng(`play:${g}`);
      let s: State = deal(`play:${g}`, suits);
      for (let step = 0; step < 250; step++) {
        const moves = legalMoves(s);
        for (const m of moves) expect(isLegal(s, m)).toBe(true);
        if (moves.length === 0) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
        expect(allCards(s)).toEqual(ALL);
        expect(s.moves).toBe(step + 1);
        for (const col of s.tableau) if (col.down.length) expect(col.up.length).toBeGreaterThan(0);
        for (const f of s.foundations) expect(f.map((c) => c.rank)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      }
    }
  });

  it("replays to the same state", () => {
    const s = deal("replay", 2);
    const moves = [legalMoves(s)[0]];
    expect(replay(s, moves)).toEqual(applyMove(s, moves[0]));
  });
});
