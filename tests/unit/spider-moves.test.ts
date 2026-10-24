import { describe, expect, it } from "vitest";
import { applyMove, deal, isLegal, legalMoves } from "@/lib/games/spider";
import { build } from "@/lib/games/spider/test-helpers";
import { columnAt, computeLayout } from "@/components/spider/layout";
import { autoMove, dealBlocked, dealsLeft, finishSkills, moveFor, pickCount, runsDone } from "@/components/spider/moves";

describe("spider taps and drags", () => {
  it("prefers the same suit, then any card, and keeps empty columns", () => {
    const state = build({
      suits: 2,
      tableau: ["KS | 7S", "QS | 8H", "JS | 8S", "", "10S | 5H"],
    });
    // 7♠ can go on 8♥ (column 2) or 8♠ (column 3): the same suit wins.
    expect(autoMove(state, { from: 0, count: 1 })).toEqual({ kind: "move", from: 0, to: 2, count: 1 });
    // 5♥ has no card to go on: the nearest empty column to the right is used (it frees the 10♠ below).
    expect(autoMove(state, { from: 4, count: 1 })).toEqual({ kind: "move", from: 4, to: 5, count: 1 });
  });

  it("never offers a whole column into an empty one", () => {
    const state = build({ suits: 1, tableau: ["| 5S", "", "KS | 9S"] });
    expect(autoMove(state, { from: 0, count: 1 })).toBeNull();
    // A drag there is still legal, if pointless.
    expect(moveFor(state, { from: 0, count: 1 }, 1)).toEqual({ kind: "move", from: 0, to: 1, count: 1 });
  });

  it("only picks up the same-suit run on top", () => {
    const state = build({ suits: 2, tableau: ["| 9H 8S 7S 6S", "| 7H"] });
    expect(pickCount(state, 0, 0)).toBe(0); // 9♥ is not in the run
    expect(pickCount(state, 0, 1)).toBe(3); // 8♠ 7♠ 6♠
    expect(pickCount(state, 0, 3)).toBe(1);
    expect(moveFor(state, { from: 1, count: 1 }, 0)).toBeNull(); // 7♥ on 6♠: wrong rank
  });

  it("only returns legal moves for drags", () => {
    const state = deal("spider-moves:2026-10-24", 1);
    for (let from = 0; from < 10; from++) {
      for (let to = 0; to < 10; to++) {
        const m = moveFor(state, { from, count: 1 }, to);
        if (m) expect(isLegal(state, m)).toBe(true);
      }
    }
    expect(moveFor(state, { from: 0, count: 1 }, 0)).toBeNull();
    // Every tap move is one of the engine's legal moves.
    const legal = legalMoves(state).map((m) => JSON.stringify(m));
    for (let from = 0; from < 10; from++) {
      const m = autoMove(state, { from, count: 1 });
      if (m) expect(legal).toContain(JSON.stringify(m));
    }
  });

  it("explains why the stock can't be dealt", () => {
    const fresh = deal("spider-moves", 1);
    expect(dealBlocked(fresh)).toBeNull();
    expect(dealsLeft(fresh)).toBe(5);
    const dealt = applyMove(fresh, { kind: "deal" });
    expect(dealsLeft(dealt)).toBe(4);
    const empty = build({ suits: 1, tableau: ["| 5S", ""], stock: "2S 3S 4S 5S 6S 7S 8S 9S 10S JS" });
    expect(dealBlocked(empty)).toMatch(/empty column/);
    expect(dealBlocked(build({ suits: 1, tableau: ["| 5S"] }))).toMatch(/stock is empty/);
    expect(runsDone(build({ suits: 1, foundations: "S S" }))).toBe(2);
  });

  it("names the skills a win earns", () => {
    expect(finishSkills(1, 0, 0, 150)).toEqual(["win-1-suit", "no-hint", "no-undo", "efficient"]);
    expect(finishSkills(4, 0, 3, 400)).toEqual(["win-4-suits", "no-hint", "4-suits-unaided"]);
    expect(finishSkills(2, 2, 1, 250)).toEqual(["win-2-suits"]);
  });
});

describe("spider layout", () => {
  it("fits ten columns on a 390px phone", () => {
    const state = deal("spider-layout", 2);
    const layout = computeLayout(state, 358, 520);
    expect(layout.cards).toHaveLength(104);
    expect(new Set(layout.cards.map((c) => c.card.id)).size).toBe(104);
    expect(layout.cardW).toBeGreaterThanOrEqual(30);
    for (const c of layout.cards) expect(c.x + layout.cardW).toBeLessThanOrEqual(358 + 1);
    // Stock, eight run slots and ten columns.
    expect(layout.piles).toHaveLength(19);
    // Only face-up tableau cards in the top run can be picked up.
    for (const c of layout.cards) if (c.movable) expect(c.faceUp && c.pile.kind === "tableau").toBe(true);
  });

  it("squeezes long columns to the height it is given, keeping ranks readable", () => {
    const long = build({ suits: 1, tableau: ["5S 5S 5S 5S 5S | KS QS JS 10S 9S 8S 7S 6S 5S 4S 3S 2S", "| AS"] });
    const roomy = computeLayout(long, 358, 2000);
    const tight = computeLayout(long, 358, 250);
    expect(tight.height).toBeLessThan(roomy.height);
    const ys = tight.cards.filter((c) => c.pile.kind === "tableau" && c.pile.index === 0 && c.faceUp).map((c) => c.y);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(12);
  });

  it("puts finished runs in the foundation slots, King on top, Ace first to land", () => {
    const state = build({ suits: 1, foundations: "S" });
    const layout = computeLayout(state, 358, 600);
    const run = layout.cards.filter((c) => c.pile.kind === "foundation");
    expect(run).toHaveLength(13);
    const king = run.find((c) => c.card.rank === 13)!;
    const ace = run.find((c) => c.card.rank === 1)!;
    expect(king.z).toBeGreaterThan(ace.z);
    expect(ace.delayMs).toBe(0);
    expect(king.delayMs).toBeGreaterThan(0);
  });

  it("maps drop points to columns", () => {
    const state = deal("spider-moves:2026-10-24", 1);
    const layout = computeLayout(state, 358, 600);
    const col3 = layout.piles.find((p) => p.pile.kind === "tableau" && p.pile.index === 3)!;
    expect(columnAt(layout, col3.x + layout.cardW / 2, col3.y + 20)).toBe(3);
    expect(columnAt(layout, col3.x + layout.cardW / 2, 5)).toBeNull(); // the top row
  });
});
