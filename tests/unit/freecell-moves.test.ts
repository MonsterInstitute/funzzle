import { describe, expect, it } from "vitest";
import { applyMove, autoMoves, dailyDeal, isLegal, isWon, type Move } from "@/lib/games/freecell";
import { build } from "@/lib/games/freecell/test-helpers";
import {
  autoMove,
  canAutoFinish,
  cardsHome,
  cellsInUse,
  finishMoves,
  moveFor,
  runTooLong,
  tapTooLong,
  tooLongMessage,
  winSkills,
} from "@/components/freecell/moves";

const col = (index: number) => ({ kind: "tableau" as const, index });
const cell = (index: number) => ({ kind: "cell" as const, index });
const home = { kind: "foundation" as const, index: 0 };

describe("freecell taps", () => {
  it("sends a playable card home first", () => {
    const s = build({ tableau: ["9S AH", "KD"] });
    expect(autoMove(s, { pile: col(0), count: 1 })).toEqual({ kind: "tableau-to-foundation", from: 0 });
  });

  it("builds on a column before using a free cell, and a free cell before an empty column", () => {
    const s = build({ tableau: ["KS 7C", "8H", "5D", ""], foundations: [0, 0, 0, 0] });
    expect(autoMove(s, { pile: col(0), count: 1 })).toEqual({ kind: "tableau-to-tableau", from: 0, to: 1, count: 1 });
    expect(autoMove(s, { pile: col(2), count: 1 })).toEqual({ kind: "tableau-to-cell", from: 2, cell: 0 });
    const full = build({ tableau: ["KS 7C", "8H", "5D", ""], cells: ["2S", "3S", "4S", "5S"] });
    expect(autoMove(full, { pile: col(2), count: 1 })).toEqual({ kind: "tableau-to-tableau", from: 2, to: 3, count: 1 });
  });

  it("moves a free-cell card onto a column, and does nothing for foundations", () => {
    const s = build({ tableau: ["8H", "KS"], cells: ["7C"] });
    expect(autoMove(s, { pile: cell(0), count: 1 })).toEqual({ kind: "cell-to-tableau", cell: 0, to: 0 });
    expect(autoMove(s, { pile: home, count: 1 })).toBeNull();
  });

  it("moves a whole run as a supermove when there is room", () => {
    // Run 7C 6H 5S onto 8D with two free cells: (2 + 1) × 2^0 = 3 cards.
    const s = build({ tableau: ["KS 7C 6H 5S", "8D", "QD", "QS", "JD", "JS", "10D", "10S"], cells: ["2S", "3S"] });
    const m = autoMove(s, { pile: col(0), count: 3 });
    expect(m).toEqual({ kind: "tableau-to-tableau", from: 0, to: 1, count: 3 });
    expect(isLegal(s, m!)).toBe(true);
  });

  it("explains when a run is too long for the free cells", () => {
    const s = build({ tableau: ["KS 7C 6H 5S", "8D", "QD", "QS", "JD", "JS", "10D", "10S"], cells: ["2S", "3S", "4S"] });
    const pick = { pile: col(0), count: 3 };
    expect(moveFor(s, pick, col(1))).toBeNull();
    expect(runTooLong(s, pick, col(1))).toBe(2);
    expect(autoMove(s, pick)).toBeNull();
    expect(tapTooLong(s, pick)).toBe(2);
    expect(tooLongMessage(s, 3, 2)).toBe(
      "That run is 3 cards. With 1 free cell and no empty columns you can move 2 at once. Free a cell or empty a column first.",
    );
    // A run that doesn't fit at all isn't "too long".
    expect(runTooLong(s, pick, col(2))).toBeNull();
  });
});

describe("freecell drags", () => {
  it("only returns legal moves", () => {
    const { state } = dailyDeal("2026-10-24");
    const piles = [...[0, 1, 2, 3].map(cell), ...[0, 1, 2, 3].map((index) => ({ kind: "foundation" as const, index })), ...[0, 1, 2, 3, 4, 5, 6, 7].map(col)];
    for (let from = 0; from < 8; from++) {
      for (const to of piles) {
        const m = moveFor(state, { pile: col(from), count: 1 }, to);
        if (m) expect(() => applyMove(state, m)).not.toThrow();
      }
    }
    expect(moveFor(state, { pile: col(0), count: 1 }, col(0))).toBeNull();
  });

  it("drops on a taken free cell into the first empty one", () => {
    const s = build({ tableau: ["9H", "KS"], cells: ["2C"] });
    expect(moveFor(s, { pile: col(0), count: 1 }, cell(0))).toEqual({ kind: "tableau-to-cell", from: 0, cell: 1 });
    expect(moveFor(s, { pile: col(0), count: 2 }, cell(2))).toBeNull();
  });
});

describe("auto-finish", () => {
  it("finishes once every column runs downward", () => {
    const s = build({
      foundations: [10, 10, 10, 9],
      cells: ["10C"],
      tableau: ["KS QH JC", "KH QS JS", "KD QD JD", "KC QC JH"],
    });
    expect(canAutoFinish(s)).toBe(true);
    const moves = finishMoves(s);
    expect(isWon(moves.reduce(applyMove, s))).toBe(true);
    expect(cardsHome(s)).toBe(39);
    expect(cellsInUse(s)).toBe(1);
  });

  it("waits while a low card is buried under a higher one", () => {
    const s = build({ foundations: [12, 12, 12, 11], tableau: ["QC KC", "KS", "KH", "KD"] });
    expect(canAutoFinish(s)).toBe(false);
  });

  it("the daily line wins when replayed with the screen's auto-moves", () => {
    const { state, solution } = dailyDeal("2026-10-24");
    let s = state;
    for (const m of solution as Move[]) {
      if (isLegal(s, m)) s = applyMove(s, m);
      for (const a of autoMoves(s)) s = applyMove(s, a);
    }
    expect(isWon(s)).toBe(true);
  });
});

describe("win skills", () => {
  it("names the skills a win exercised", () => {
    expect(winSkills({ hints: 0, undos: 0, moves: 80, timeMs: 200_000, peakCells: 2, longestRun: 3 })).toEqual([
      "win",
      "no-hint",
      "supermove",
      "two-cells",
      "fast",
      "efficient",
      "clean",
    ]);
    expect(winSkills({ hints: 2, undos: 1, moves: 140, timeMs: 600_000, peakCells: 4, longestRun: 1 })).toEqual(["win"]);
  });
});
