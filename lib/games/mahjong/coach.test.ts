import { beforeEach, describe, expect, it } from "vitest";
import { applyMatch, bestMove, canMatch, dailyDeal, generateDeal, isWon, matchingPairs, type State } from "./index";
import { clearKnownLines, knownLine } from "./solver";
import { at, board } from "./test-helpers";

beforeEach(() => clearKnownLines());

const p = (x: number, z: number) => at("pyramid", x, 6, z);

describe("bestMove", () => {
  it("explains a pair that frees the tiles under it", () => {
    const s = board("pyramid", { "8,6,3": "7d", "10,6,3": "7d", "8,6,4": "rd", "10,6,4": "rd" });
    const hint = bestMove(s)!;
    expect(hint.pair).toEqual([p(8, 4), p(10, 4)]);
    expect(hint.reason).toBe("last-two");
    expect(hint.winning).toBe(true);
    expect(hint.text).toBe(
      "Match the last two Red Dragons on top of the stack: they can only go with each other, and that frees 2 tiles below.",
    );
  });

  it("says which of three free tiles to keep", () => {
    const s = board("pyramid", {
      "6,6,3": "7d",
      "8,6,3": "rd",
      "10,6,3": "7d",
      "12,6,3": "7d",
      "8,6,4": "7d",
      "10,6,4": "rd",
    });
    const hint = bestMove(s)!;
    expect(hint.pair.slice().sort((a, b) => a - b)).toEqual([p(6, 3), p(8, 4)].sort((a, b) => a - b));
    expect(hint.reason).toBe("keep-third");
    expect(hint.winning).toBe(true);
    expect(hint.text).toBe(
      "Take the pair of 7 Dots on top of the stack that frees 1 tile below and keeps the third 7 Dots free for the last one.",
    );
  });

  it("calls a pairing safe when all four are free", () => {
    const s = board("pyramid", { "6,6,3": "f1", "12,6,3": "f2", "8,6,4": "f3", "10,6,4": "f4", "8,6,3": "1c", "10,6,3": "1c" });
    const hint = bestMove(s, { maxNodes: 1 })!;
    expect(hint.reason).toBe("all-four");
    expect(hint.text).toMatch(/^Match two of the four Flowers: all four are free, so any pairing is safe/);
  });

  it("falls back to heuristics when no line is known", () => {
    const s = board("pyramid", { "8,6,3": "7d", "8,6,4": "rd", "10,6,3": "rd", "10,6,4": "7d", "6,6,3": "1b", "12,6,3": "1b" });
    const hint = bestMove(s)!;
    expect(hint.winning).toBe(false);
    expect(hint.pair).toEqual([p(6, 3), p(12, 3)]);
    expect(hint.text).toMatch(/^Match the last two 1 Bamboo/);
    expect(bestMove(board("pyramid", { "8,6,3": "7d", "8,6,4": "7d" }))).toBeNull();
  });

  it("follows the daily solution", () => {
    const daily = dailyDeal("2026-10-24", "turtle");
    const hint = bestMove(daily.state)!;
    expect(hint.pair).toEqual(daily.solution[0]);
    expect(hint.winning).toBe(true);
    expect(hint.text).toMatch(/^(Match|Take) .+: |^Take the pair of .+\.$/);
  });

  for (const layout of ["turtle", "quick"] as const) {
    it(`wins a ${layout} game by following its hints, even after a few wrong turns`, () => {
      const daily = dailyDeal("2026-08-08", layout);
      let s: State = daily.state;
      let steps = 0;
      let wrong = 0;
      while (!isWon(s)) {
        const hint = bestMove(s)!;
        expect(hint).not.toBeNull();
        expect(canMatch(s, hint.pair)).toBe(true);
        expect(hint.text.endsWith(".")).toBe(true);
        expect(hint.text.split(". ").length).toBe(1);
        expect(hint.winning).toBe(true);
        // Every fifth move, play some other pair instead, as long as the coach can repair its line.
        let next = applyMatch(s, hint.pair);
        if (steps % 5 === 4) {
          const other = matchingPairs(s)
            .filter((x) => x[0] !== hint.pair[0] || x[1] !== hint.pair[1])
            .map((x) => applyMatch(s, x))
            .find((after) => knownLine(after));
          if (other) {
            next = other;
            wrong++;
          }
        }
        s = next;
        if (++steps > 200) throw new Error("no progress");
      }
      expect(wrong).toBeGreaterThan(0);
    });
  }

  it("gives legal hints across generated deals", () => {
    for (let i = 0; i < 4; i++) {
      const { state } = generateDeal("bridge", `coach:${i}`);
      const hint = bestMove(state, { maxNodes: 2_000 })!;
      expect(canMatch(state, hint.pair)).toBe(true);
    }
  });
});
