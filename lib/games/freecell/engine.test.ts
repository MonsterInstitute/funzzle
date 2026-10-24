import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import {
  applyMove,
  autoMoves,
  cardLabel,
  deal,
  isLegal,
  isSafeHome,
  isWon,
  legalMoves,
  maxRun,
  positionKey,
  runLength,
  type Card,
  type Move,
  type State,
} from "./index";
import { allCards, build, c, replay } from "./test-helpers";

const ALL = Array.from({ length: 52 }, (_, i) => i);
const labels = (cards: Card[]) => cards.map(cardLabel);

describe("deal", () => {
  it("is deterministic per seed", () => {
    expect(deal("abc")).toEqual(deal("abc"));
    expect(deal("abc")).not.toEqual(deal("abd"));
  });

  it("deals all 52 cards face up into 7,7,7,7,6,6,6,6", () => {
    for (const seed of ["a", "b", "freecell:2026-10-24:0"]) {
      const s = deal(seed);
      expect(allCards(s)).toEqual(ALL);
      expect(s.tableau.map((col) => col.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
      expect(s.cells).toEqual([null, null, null, null]);
      expect(s.foundations.every((f) => f.length === 0)).toBe(true);
      expect(s.moves).toBe(0);
    }
  });

  it("survives a JSON round trip and keeps playing", () => {
    const s = deal("json");
    const copy = JSON.parse(JSON.stringify(s)) as State;
    expect(copy).toEqual(s);
    expect(legalMoves(copy)).toEqual(legalMoves(s));
    expect(positionKey(copy)).toBe(positionKey(s));
    const m = legalMoves(copy)[0];
    expect(applyMove(copy, m)).toEqual(applyMove(s, m));
  });
});

describe("single-card moves", () => {
  it("column to free cell and back", () => {
    const s = build({ tableau: ["9H 7C", "8H"], cells: ["-", "KS"] });
    expect(isLegal(s, { kind: "tableau-to-cell", from: 0, cell: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-cell", from: 2, cell: 0 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-cell", from: 0, cell: 4 })).toBe(false);
    const t = applyMove(s, { kind: "tableau-to-cell", from: 0, cell: 0 });
    expect(t.cells[0] && cardLabel(t.cells[0])).toBe("7♣");
    expect(labels(t.tableau[0])).toEqual(["9♥"]);
    expect(t.moves).toBe(1);
    expect(s.tableau[0]).toHaveLength(2); // original untouched

    expect(isLegal(t, { kind: "cell-to-tableau", cell: 0, to: 1 })).toBe(true);
    expect(isLegal(t, { kind: "cell-to-tableau", cell: 0, to: 0 })).toBe(false);
    expect(isLegal(t, { kind: "cell-to-tableau", cell: 2, to: 1 })).toBe(false);
    // Any card may start an empty column, not just a King.
    expect(isLegal(t, { kind: "cell-to-tableau", cell: 0, to: 5 })).toBe(true);
    const u = applyMove(t, { kind: "cell-to-tableau", cell: 0, to: 1 });
    expect(labels(u.tableau[1])).toEqual(["8♥", "7♣"]);
    expect(u.cells[0]).toBeNull();
  });

  it("foundations take the next card of the suit from a column or a cell", () => {
    const s = build({ tableau: ["5D AS", "2S"], cells: ["2H"], foundations: [0, 1, 0, 0] });
    expect(isLegal(s, { kind: "tableau-to-foundation", from: 1 })).toBe(false);
    expect(isLegal(s, { kind: "cell-to-foundation", cell: 0 })).toBe(true);
    expect(isLegal(s, { kind: "cell-to-foundation", cell: 1 })).toBe(false);
    const t = replay(s, [
      { kind: "tableau-to-foundation", from: 0 },
      { kind: "tableau-to-foundation", from: 1 },
      { kind: "cell-to-foundation", cell: 0 },
    ]);
    expect(t.foundations.map((f) => f.length)).toEqual([2, 2, 0, 0]);
    expect(labels(t.foundations[0])).toEqual(["A♠", "2♠"]);
    expect(t.cells[0]).toBeNull();
  });

  it("columns build down in alternating colours", () => {
    const s = build({ tableau: ["7C", "8H", "8S", "9D", ""] });
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 1 })).toBe(true);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 2, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 3, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 4, count: 1 })).toBe(true);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 0, count: 1 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 0, to: 1, count: 0 })).toBe(false);
    expect(isLegal(s, { kind: "tableau-to-tableau", from: 4, to: 1, count: 1 })).toBe(false);
  });

  it("applyMove throws on illegal moves", () => {
    expect(() => applyMove(build({}), { kind: "tableau-to-cell", from: 0, cell: 0 })).toThrow(/Illegal/);
    expect(() => applyMove(build({}), { kind: "cell-to-foundation", cell: 9 })).toThrow();
    expect(() => applyMove(build({}), { kind: "bogus" } as unknown as Move)).toThrow(/unknown/);
  });
});

describe("supermoves", () => {
  // A 7-card run 9♠..3♠ in column 1, a 10♥ to put it on, and spots for partial runs.
  const layout = (cells: string[], emptyLast: boolean) =>
    build({
      tableau: ["9S 8H 7S 6H 5S 4H 3S", "10H", "6D", "8D", "KC", "KD", "QC", emptyLast ? "" : "JD"],
      cells,
    });

  it("capacity is (free cells + 1) × 2^(empty columns), halved into an empty column", () => {
    expect(maxRun(layout([], false), false)).toBe(5);
    expect(maxRun(layout(["AH", "AD", "AC", "AS"], false), false)).toBe(1);
    expect(maxRun(layout(["AH", "AD", "AC"], true), false)).toBe(4);
    expect(maxRun(layout(["AH", "AD", "AC"], true), true)).toBe(2);
    expect(maxRun(layout(["AH"], true), false)).toBe(8);
    expect(maxRun(layout(["AH"], true), true)).toBe(4);
    expect(maxRun(build({}), true)).toBe(5 * 2 ** 7);
    expect(runLength(layout([], false).tableau[0])).toBe(7);
    expect(runLength(build({ tableau: ["9S 8H 7H 6S"] }).tableau[0])).toBe(2);
  });

  it("allows runs up to the capacity and no further", () => {
    const run = (s: State, to: number, count: number) => isLegal(s, { kind: "tableau-to-tableau", from: 0, to, count });

    const open = layout([], false); // capacity 5
    expect(run(open, 1, 7)).toBe(false);
    expect(run(open, 3, 5)).toBe(true); // 7♠..3♠ onto 8♦
    expect(run(open, 2, 3)).toBe(true); // 5♠..3♠ onto 6♦
    expect(run(open, 2, 2)).toBe(false); // 4♥ does not go on 6♦

    const tight = layout(["AH", "AD", "AC"], true); // 4, or 2 into the empty column
    expect(run(tight, 3, 5)).toBe(false);
    expect(run(tight, 2, 3)).toBe(true);
    expect(run(tight, 7, 2)).toBe(true);
    expect(run(tight, 7, 3)).toBe(false);

    const roomy = layout(["AH"], true); // 8, or 4 into the empty column
    expect(run(roomy, 1, 7)).toBe(true);
    expect(run(roomy, 7, 4)).toBe(true);
    expect(run(roomy, 7, 5)).toBe(false);
    const t = applyMove(roomy, { kind: "tableau-to-tableau", from: 0, to: 1, count: 7 });
    expect(labels(t.tableau[1])).toEqual(["10♥", "9♠", "8♥", "7♠", "6♥", "5♠", "4♥", "3♠"]);
    expect(t.tableau[0]).toEqual([]);
    expect(t.cells).toEqual(roomy.cells);
  });

  it("legalMoves lists exactly the runs the capacity allows", () => {
    const fromFirst = (s: State) =>
      legalMoves(s)
        .filter((m) => m.kind === "tableau-to-tableau" && m.from === 0)
        .map((m) => (m.kind === "tableau-to-tableau" ? `${m.to}:${m.count}` : ""))
        .sort();
    expect(fromFirst(layout([], false))).toEqual(["2:3", "3:5"]);
    expect(fromFirst(layout(["AH", "AD", "AC"], true))).toEqual(["2:3", "7:1", "7:2"]);
    expect(fromFirst(layout(["AH"], true))).toEqual(["1:7", "2:3", "3:5", "7:1", "7:2", "7:3", "7:4"]);
  });
});

describe("autoMoves", () => {
  it("sends Aces and twos home from cells and columns, chaining", () => {
    const s = build({ tableau: ["9C 2S", "AS", "KD"], cells: ["AH", "-", "2H"] });
    const moves = autoMoves(s);
    const t = replay(s, moves);
    expect(t.foundations.map((f) => f.length)).toEqual([2, 2, 0, 0]);
    expect(t.cells).toEqual([null, null, null, null]);
    expect(labels(t.tableau[0])).toEqual(["9♣"]);
    expect(autoMoves(t)).toEqual([]);
  });

  it("only moves a card once both opposite-colour cards one rank lower are home", () => {
    // 3♠ is safe only when 2♥ and 2♦ are home: nothing red could need it.
    expect(isSafeHome(build({ foundations: [2, 2, 2, 0] }), c("3S"))).toBe(true);
    expect(isSafeHome(build({ foundations: [2, 1, 2, 2] }), c("3S"))).toBe(false);
    expect(isSafeHome(build({ foundations: [3, 0, 0, 0] }), c("3S"))).toBe(false);
    expect(autoMoves(build({ tableau: ["3S"], foundations: [2, 1, 2, 2] }))).toEqual([]);
    expect(autoMoves(build({ tableau: ["3S"], foundations: [2, 2, 1, 2] }))).toEqual([]);
    expect(autoMoves(build({ tableau: ["3S"], foundations: [2, 2, 2, 0] }))).toEqual([
      { kind: "tableau-to-foundation", from: 0 },
    ]);
    // 7♥ waits for the 6♠ and 6♣ even though it fits its foundation.
    const s = build({ tableau: ["7H"], foundations: [6, 6, 6, 5] });
    expect(isLegal(s, { kind: "tableau-to-foundation", from: 0 })).toBe(true);
    expect(autoMoves(s)).toEqual([]);
  });

  it("finishes a fully sorted position and wins", () => {
    const s = build({
      tableau: ["KS QH JS", "KH QS JH", "KD QC JD", "KC QD JC"],
      foundations: [10, 10, 10, 10],
    });
    const t = replay(s, autoMoves(s));
    expect(isWon(t)).toBe(true);
  });
});

describe("positionKey", () => {
  it("tells positions apart and ignores the move count", () => {
    const s = deal("key");
    const m = legalMoves(s)[0];
    expect(positionKey(applyMove(s, m))).not.toBe(positionKey(s));
    expect(positionKey({ ...s, moves: 9 })).toBe(positionKey(s));
  });
});

describe("random play", () => {
  it("legalMoves are all legal and the deck is conserved", () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng(`play:${g}`);
      let s: State = deal(`play:${g}`);
      for (let step = 0; step < 200; step++) {
        const moves = legalMoves(s);
        for (const m of moves) expect(isLegal(s, m)).toBe(true);
        if (moves.length === 0) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
        expect(allCards(s)).toEqual(ALL);
        expect(s.moves).toBe(step + 1);
        for (const col of s.tableau) {
          // Every run legalMoves offers must still be a valid run after the move.
          expect(runLength(col)).toBeLessThanOrEqual(col.length);
        }
      }
    }
  });
});
