import { describe, expect, it } from "vitest";
import { applyMove, dailyDeal, deal, type State } from "@/lib/games/solitaire";
import { computeLayout } from "@/components/solitaire/layout";
import { autoMove, cardsHome, moveFor } from "@/components/solitaire/moves";

describe("solitaire taps and drags", () => {
  it("sends an ace home on tap", () => {
    // Find a deal with an ace face up in the tableau.
    let state: State | null = null;
    let col = -1;
    for (let i = 0; i < 200 && !state; i++) {
      const s = deal(`moves:${i}`);
      col = s.tableau.findIndex((c) => c.up.at(-1)?.rank === 1);
      if (col >= 0) state = s;
    }
    expect(state).not.toBeNull();
    const m = autoMove(state!, { pile: { kind: "tableau", index: col }, count: 1 });
    expect(m).toEqual({ kind: "tableau-to-foundation", from: col });
    expect(cardsHome(applyMove(state!, m!))).toBe(1);
  });

  it("only returns legal moves for drags", () => {
    const { state } = dailyDeal("2026-10-24", 1);
    for (let from = 0; from < 7; from++) {
      for (let to = 0; to < 7; to++) {
        const m = moveFor(state, { pile: { kind: "tableau", index: from }, count: 1 }, { kind: "tableau", index: to });
        if (m) expect(() => applyMove(state, m)).not.toThrow();
      }
    }
    expect(moveFor(state, { pile: { kind: "tableau", index: 0 }, count: 1 }, { kind: "tableau", index: 0 })).toBeNull();
  });

  it("lays out all 52 cards inside the board width", () => {
    const { state } = dailyDeal("2026-10-24", 3);
    const layout = computeLayout(state, 358, 600);
    expect(layout.cards).toHaveLength(52);
    expect(new Set(layout.cards.map((c) => c.card.id)).size).toBe(52);
    for (const c of layout.cards) expect(c.x + layout.cardW).toBeLessThanOrEqual(358 + 1);
    expect(layout.piles).toHaveLength(13);
  });
});
