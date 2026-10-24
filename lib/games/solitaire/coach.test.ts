import { beforeEach, describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { applyMove, bestMove, dailyDeal, deal, describeMove, isLegal, isWon, legalMoves, type State } from "./index";
import { clearKnownLines } from "./solver";
import { build } from "./test-helpers";

beforeEach(() => clearKnownLines());

describe("describeMove", () => {
  it("names the cards involved", () => {
    const s = build({
      waste: "7C",
      stock: "2D 3D",
      foundations: [0, 5, 0, 0],
      tableau: ["|8H", "|AH", "4S|9C 8D 7S", "|", "|7S"],
    });
    expect(describeMove(s, { kind: "draw" })).toBe("Draw a card");
    expect(describeMove({ ...s, draw: 3 }, { kind: "draw" })).toBe("Draw 2 cards");
    expect(describeMove(s, { kind: "waste-to-tableau", to: 0 })).toBe("Move the 7♣ from the waste onto the 8♥");
    expect(describeMove(s, { kind: "tableau-to-foundation", from: 1 })).toBe("Move the A♥ to its foundation");
    expect(describeMove(s, { kind: "tableau-to-tableau", from: 4, to: 0, count: 1 })).toBe("Move the 7♠ onto the 8♥");
    expect(describeMove(s, { kind: "tableau-to-tableau", from: 2, to: 3, count: 3 })).toBe(
      "Move the 9♣ to 7♠ run to empty column 4",
    );
    expect(describeMove(s, { kind: "foundation-to-tableau", suit: "H", to: 4 })).toBe(
      "Move the 5♥ from its foundation onto the 7♠",
    );
    expect(describeMove(s, { kind: "recycle" })).toMatch(/waste/);
  });
});

describe("bestMove", () => {
  it("prefers turning over a hidden card and explains it", () => {
    const s = build({ tableau: ["|8H", "5D 2S|7C"], stock: "KD", foundations: [0, 0, 0, 0] });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "tableau-to-tableau", from: 1, to: 0, count: 1 });
    expect(hint.reason).toBe("reveal");
    expect(hint.winning).toBe(false);
    expect(hint.text).toBe("Move the 7♣ onto the 8♥. It turns over a hidden card in column 2, which can open up new moves.");
  });

  it("suggests the foundation, drawing and recycling", () => {
    const home = bestMove(build({ waste: "AH", tableau: ["|9S"] }), { maxNodes: 1 })!;
    expect(home.reason).toBe("foundation");
    expect(home.move).toEqual({ kind: "waste-to-foundation" });

    const draw = bestMove(build({ stock: "4C", tableau: ["|9S"] }), { maxNodes: 1 })!;
    expect(draw.move).toEqual({ kind: "draw" });
    expect(draw.reason).toBe("draw");
    expect(draw.text).toMatch(/^Draw a card\. /);

    const recycle = bestMove(build({ waste: "4C", tableau: ["|9S"] }), { maxNodes: 1 })!;
    expect(recycle.move).toEqual({ kind: "recycle" });
    expect(recycle.reason).toBe("recycle");
  });

  it("returns null when the game is won", () => {
    expect(bestMove(build({ foundations: [13, 13, 13, 13] }))).toBeNull();
  });

  it("names the card a winning draw is looking for", () => {
    const s = build({ foundations: [12, 13, 13, 13], stock: "KS" });
    const hint = bestMove(s)!;
    expect(hint.winning).toBe(true);
    expect(hint.text).toBe("Draw a card. The K♠ you need next is in the stock.");
  });

  it("always returns a legal move from mid-game positions", () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng(`coach:${g}`);
      let s: State = deal(`coach:${g}`, g % 3 ? 1 : 3);
      for (let step = 0; step < 20 + g * 3; step++) {
        const moves = legalMoves(s);
        if (!moves.length) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
      }
      const hint = bestMove(s, { maxNodes: 20_000 });
      if (!hint) continue;
      expect(isLegal(s, hint.move)).toBe(true);
      expect(hint.text.split(". ")).toHaveLength(2);
      expect(hint.text.endsWith(".")).toBe(true);
    }
  }, 120_000);

  it("following the coach from a daily deal wins the game", () => {
    const deals = [
      ...["2026-10-24", "2026-10-25", "2026-11-01", "2027-01-01"].map((d) => dailyDeal(d, 1)),
      ...["2026-10-24", "2026-12-25"].map((d) => dailyDeal(d, 3)),
    ];
    for (const { state } of deals) {
      let s = state;
      for (let step = 0; step < 2000 && !isWon(s); step++) {
        const hint = bestMove(s)!;
        expect(hint.winning).toBe(true);
        expect(hint.text.length).toBeGreaterThan(10);
        s = applyMove(s, hint.move);
      }
      expect(isWon(s)).toBe(true);
    }
  }, 120_000);

  it("finds a winning line by itself without a remembered one", () => {
    const { state } = dailyDeal("2026-10-26");
    clearKnownLines();
    let s = state;
    for (let step = 0; step < 2000 && !isWon(s); step++) {
      const hint = bestMove(s, { maxNodes: 200_000 })!;
      s = applyMove(s, hint.move);
    }
    expect(isWon(s)).toBe(true);
  }, 60_000);
});
