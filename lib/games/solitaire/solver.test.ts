import { describe, expect, it } from "vitest";
import { dailyDeal, deal, isLegal, solve } from "./index";
import { build, replay, wins } from "./test-helpers";
import { isWon } from "./engine";

/** Test dates spread over a year. */
const dates = (n: number, start = Date.UTC(2026, 0, 1), step = 17) =>
  Array.from({ length: n }, (_, i) => new Date(start + i * step * 86_400_000).toISOString().slice(0, 10));

describe("solve", () => {
  it("returns replayable winning lines for most draw-1 deals", () => {
    let won = 0;
    for (let i = 0; i < 30; i++) {
      const state = deal(`solve-test:${i}`);
      const res = solve(state);
      expect(["win", "unknown", "lose"]).toContain(res.result);
      if (res.result === "win") {
        won++;
        expect(wins(state, res.moves)).toBe(true);
      } else {
        expect(res.moves).toEqual([]);
      }
    }
    expect(won).toBeGreaterThanOrEqual(18);
  }, 120_000);

  it("returns replayable winning lines for draw-3 deals", () => {
    let won = 0;
    for (let i = 0; i < 12; i++) {
      const state = deal(`solve-test-3:${i}`, 3);
      const res = solve(state);
      if (res.result === "win") {
        won++;
        expect(wins(state, res.moves)).toBe(true);
      }
    }
    expect(won).toBeGreaterThanOrEqual(6);
  }, 120_000);

  it("solves from a mid-game position", () => {
    const start = dailyDeal("2026-03-03").state;
    const { solution } = dailyDeal("2026-03-03");
    const mid = replay(start, solution.slice(0, 40));
    const res = solve(mid);
    expect(res.result).toBe("win");
    expect(isLegal(mid, res.moves[0])).toBe(true);
    expect(wins(mid, res.moves)).toBe(true);
  }, 60_000);

  it("handles won, finishable and stuck positions", () => {
    expect(solve(build({ foundations: [13, 13, 13, 13] }))).toEqual({ result: "win", moves: [], nodes: 0 });

    const open = build({ foundations: [12, 11, 13, 13], tableau: ["|KS QH"], waste: "KH" });
    const res = solve(open);
    expect(res.result).toBe("win");
    expect(wins(open, res.moves)).toBe(true);

    // Every red card is home and both black aces are buried under their twos: no way out.
    const stuck = build({
      foundations: [0, 13, 13, 0],
      tableau: ["AS|2S", "AC|2C", "|KS", "|KC", "|QS", "|QC", "|JS"],
      stock: "3S 4S 5S 6S 7S 8S 9S 10S 3C 4C 5C 6C 7C 8C 9C 10C JC",
    });
    expect(solve(stuck).result).toBe("lose");
  });

  it("stops at the node budget", () => {
    const res = solve(deal("budget"), { maxNodes: 1 });
    expect(res.result).toBe("unknown");
    expect(res.nodes).toBeLessThanOrEqual(1);
  });

  it("does not change the state it is given", () => {
    const state = deal("immutable");
    const before = JSON.stringify(state);
    solve(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("dailyDeal", () => {
  it("gives a verified-winnable draw-1 deal for 20 dates", () => {
    for (const date of dates(20)) {
      const daily = dailyDeal(date);
      expect(daily.seed).toMatch(new RegExp(`^solitaire:${date}:1:\\d+$`));
      expect(daily.state).toEqual(deal(daily.seed, 1));
      expect(isWon(replay(daily.state, daily.solution))).toBe(true);
    }
  }, 180_000);

  it("gives a verified-winnable draw-3 deal for 5 dates", () => {
    for (const date of dates(5, Date.UTC(2026, 9, 20), 3)) {
      const daily = dailyDeal(date, 3);
      expect(daily.seed).toMatch(new RegExp(`^solitaire:${date}:3:\\d+$`));
      expect(daily.state.draw).toBe(3);
      expect(isWon(replay(daily.state, daily.solution))).toBe(true);
    }
  }, 120_000);

  it("is the same deal for everyone on a date", () => {
    expect(dailyDeal("2026-10-24").seed).toBe(dailyDeal("2026-10-24").seed);
    expect(dailyDeal("2026-10-24").state).not.toEqual(dailyDeal("2026-10-25").state);
  }, 60_000);

  it("rejects malformed dates", () => {
    expect(() => dailyDeal("24/10/2026")).toThrow();
  });
});
