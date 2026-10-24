import { beforeEach, describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { applyMove, bestMove, dailyDeal, deal, describeMove, isLegal, isWon, legalMoves, type State } from "./index";
import { clearKnownLines } from "./solver";
import { build, run } from "./test-helpers";

beforeEach(() => clearKnownLines());

/** One sentence: ends with a full stop and has no other sentence break. */
const oneSentence = (text: string) => text.endsWith(".") && !text.slice(0, -1).includes(". ");

/** Eight Kings and two Jacks: nothing on the table can move. */
const blocked = ["KS", "KH", "KD", "KC", "KS", "KH", "KD", "KC", "JS", "JH"].map((t, i) => `${i + 2}D|${t}`);

describe("describeMove", () => {
  it("names the cards involved", () => {
    const s = build({ tableau: ["|8H", "4S|9C 7C 6C", "|", "|8C"], stock: "2D" });
    // describeMove only names the cards; it does not check the move is legal.
    expect(describeMove(s, { kind: "move", from: 1, to: 0, count: 2 })).toBe("Move the 7♣ to 6♣ run onto the 8♥");
    expect(describeMove(s, { kind: "move", from: 3, to: 0, count: 1 })).toBe("Move the 8♣ onto the 8♥");
    expect(describeMove(s, { kind: "move", from: 1, to: 2, count: 2 })).toBe("Move the 7♣ to 6♣ run to empty column 3");
    expect(describeMove(s, { kind: "deal" })).toBe("Deal a new row from the stock");
  });
});

describe("bestMove", () => {
  it("prefers turning over a hidden card and explains it", () => {
    const s = build({ tableau: ["|8H", "5D 2S|7C", "|9S 8S"] });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "move", from: 1, to: 0, count: 1 });
    expect(hint.reason).toBe("reveal");
    expect(hint.winning).toBe(false);
    expect(hint.text).toBe("Moving the 7♣ onto the 8♥ turns over a hidden card in column 2, which can open up new moves.");
  });

  it("completes a run before anything else", () => {
    const s = build({ tableau: ["|" + run("S", 13, 2), "|AS", "3D|7C", "|8H"] });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "move", from: 1, to: 0, count: 1 });
    expect(hint.reason).toBe("complete-run");
    expect(hint.text).toBe(
      "Moving the A♠ onto the 2♠ completes a King-to-Ace run of spades, which clears it off the table for 100 points.",
    );
  });

  it("keeps suits together", () => {
    const s = build({ tableau: ["|8H", "|8S", "QD|KC 7S"] });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "move", from: 2, to: 1, count: 1 });
    expect(hint.reason).toBe("same-suit");
    expect(hint.text).toBe("Moving the 7♠ onto the 8♠ joins it to more spades and uncovers the K♣ so another card can go on it.");
  });

  it("empties a column", () => {
    const s = build({ tableau: ["|9D", "|8C", ...blocked.slice(2)] });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "move", from: 1, to: 0, count: 1 });
    expect(hint.reason).toBe("empty-column");
    expect(hint.text).toBe("Moving the 8♣ onto the 9♦ empties column 2, giving you a free space where any card or run can go.");
  });

  it("uses an empty column only when it frees a card with somewhere to go", () => {
    // Kings without hidden cards under them: moving one to the empty column achieves nothing.
    const kings = ["KS", "KH", "KD", "KC", "KS", "KH", "KD"].map((k) => "|" + k);
    const s = build({ tableau: ["|9D 5C", "|10S", "|", ...kings], stock: "2H" });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "move", from: 0, to: 2, count: 1 });
    expect(hint.reason).toBe("to-empty");
    expect(hint.text).toBe("Moving the 5♣ to empty column 3 uncovers the 9♦, which can then move onto another column.");
    // Without the 10♠ the 9♦ has nowhere to go, so the empty column is kept.
    expect(bestMove(build({ tableau: ["|9D 5C", "|2S", "|", ...kings] }), { maxNodes: 1 })).toBeNull();
  });

  it("deals when nothing on the table helps", () => {
    const hint = bestMove(build({ tableau: blocked, stock: "5H 6H" }), { maxNodes: 1 })!;
    expect(hint.move).toEqual({ kind: "deal" });
    expect(hint.reason).toBe("deal");
    expect(oneSentence(hint.text)).toBe(true);
  });

  it("returns null when the game is won or nothing is left", () => {
    expect(bestMove(build({ foundations: "S S H H D D C C" }))).toBeNull();
    expect(bestMove(build({ tableau: blocked }))).toBeNull();
  });

  it("always returns a legal move with a one-sentence reason", () => {
    for (let g = 0; g < 18; g++) {
      const suits = ([1, 2, 4] as const)[g % 3];
      const rng = createRng(`coach:${g}`);
      let s: State = deal(`coach:${g}`, suits);
      for (let step = 0; step < 15 + g * 4; step++) {
        const moves = legalMoves(s);
        if (!moves.length) break;
        s = applyMove(s, moves[rng.int(moves.length)]);
      }
      const hint = bestMove(s, { maxNodes: 3_000 });
      if (!hint) continue;
      expect(isLegal(s, hint.move)).toBe(true);
      expect(oneSentence(hint.text)).toBe(true);
      expect(hint.text.startsWith("Moving ") || hint.text.startsWith("Dealing ")).toBe(true);
    }
  }, 30_000);

  it("following the coach from a daily deal wins the game", () => {
    const deals = [dailyDeal("2026-10-24", 1), dailyDeal("2026-12-25", 1), dailyDeal("2026-10-24", 2)];
    for (const { state } of deals) {
      let s = state;
      for (let step = 0; step < 2000 && !isWon(s); step++) {
        const hint = bestMove(s)!;
        expect(hint.winning).toBe(true);
        expect(oneSentence(hint.text)).toBe(true);
        s = applyMove(s, hint.move);
      }
      expect(isWon(s)).toBe(true);
    }
  }, 30_000);

  it("finds a winning line by itself without a remembered one", () => {
    const { state } = dailyDeal("2026-10-26", 1);
    clearKnownLines();
    let s = state;
    for (let step = 0; step < 2000 && !isWon(s); step++) s = applyMove(s, bestMove(s)!.move);
    expect(isWon(s)).toBe(true);
  }, 30_000);
});
