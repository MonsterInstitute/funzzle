import { describe, expect, it } from "vitest";
import { applyMove, dailyDeal, deal, legalMoves } from "@/lib/games/freecell";
import { build } from "@/lib/games/freecell/test-helpers";
import { computeLayout, MIN_STEP } from "@/components/freecell/layout";

describe("freecell layout", () => {
  it("lays out all 52 cards inside a 390px phone's board", () => {
    const { state } = dailyDeal("2026-10-24");
    const layout = computeLayout(state, 358, 600);
    expect(layout.cards).toHaveLength(52);
    expect(new Set(layout.cards.map((c) => c.card.id)).size).toBe(52);
    for (const c of layout.cards) expect(c.x + layout.cardW).toBeLessThanOrEqual(358);
    // 4 free cells, 4 foundations, 8 columns.
    expect(layout.piles).toHaveLength(16);
    expect(layout.cardW).toBeGreaterThanOrEqual(40);
  });

  it("marks only the top run of a column as movable", () => {
    const s = build({ tableau: ["KS 9H 8C 7D", "AC"], cells: ["2C"] });
    const layout = computeLayout(s, 358, 600);
    const movable = layout.cards.filter((c) => c.movable).map((c) => c.card.id);
    const byCode = (rank: number, suit: string) => layout.cards.find((c) => c.card.rank === rank && c.card.suit === suit)!;
    expect(byCode(13, "S").movable).toBe(false);
    expect(byCode(9, "H").movable).toBe(true);
    expect(byCode(7, "D").movable).toBe(true);
    expect(byCode(2, "C").movable).toBe(true);
    expect(movable).toHaveLength(5);
  });

  it("squeezes a long column to fit the height", () => {
    const tall = build({ tableau: ["KS QH JS 10H 9S 8H 7S 6H 5S 4H 3S 2H KD QC JD 10C 9D 8C 7D"] });
    const layout = computeLayout(tall, 358, 520);
    const col = layout.cards.filter((c) => c.pile.kind === "tableau" && c.pile.index === 0);
    const bottom = Math.max(...col.map((c) => c.y)) + layout.cardH;
    expect(bottom).toBeLessThanOrEqual(520 + 1);
    expect(col[1].y - col[0].y).toBeGreaterThanOrEqual(MIN_STEP);
  });

  it("keeps cards in place for any first move", () => {
    const s = deal("layout");
    for (const m of legalMoves(s).slice(0, 20)) {
      const layout = computeLayout(applyMove(s, m), 358, 600);
      expect(layout.cards).toHaveLength(52);
    }
  });
});
