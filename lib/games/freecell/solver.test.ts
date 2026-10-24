import { describe, expect, it } from "vitest";
import { dailyDeal, deal, isLegal, isWon, solve } from "./index";
import { build, replay, wins } from "./test-helpers";

/** Test dates spread over a year. */
const dates = (n: number, start = Date.UTC(2026, 0, 1), step = 17) =>
  Array.from({ length: n }, (_, i) => new Date(start + i * step * 86_400_000).toISOString().slice(0, 10));

describe("solve", () => {
  it("wins random deals quickly with lines that replay through the engine", () => {
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const state = deal(`solve-test:${i}`);
      const t0 = performance.now();
      const res = solve(state);
      times.push(performance.now() - t0);
      expect(res.result).toBe("win");
      expect(wins(state, res.moves)).toBe(true);
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(200);
    expect(times[times.length - 1]).toBeLessThan(2000);
  }, 60_000);

  it("solves from a mid-game position", () => {
    const { state, solution } = dailyDeal("2026-03-03");
    const mid = replay(state, solution.slice(0, 30));
    const res = solve(mid);
    expect(res.result).toBe("win");
    expect(isLegal(mid, res.moves[0])).toBe(true);
    expect(wins(mid, res.moves)).toBe(true);
  });

  it("handles won, nearly won and stuck positions", () => {
    expect(solve(build({ foundations: [13, 13, 13, 13] }))).toEqual({ result: "win", moves: [], nodes: 0 });

    const near = build({ foundations: [12, 11, 13, 13], tableau: ["KH QH", "KS"] });
    const res = solve(near);
    expect(res.result).toBe("win");
    expect(wins(near, res.moves)).toBe(true);

    // Only black cards are left, so nothing stacks, and both Aces sit under two cards with one cell free.
    const stuck = build({
      foundations: [0, 13, 13, 0],
      cells: ["KS", "KC", "QS"],
      tableau: ["AS 5S 6S", "AC 5C 6C", "2S 3S 4S", "2C 3C 4C", "7S 8S 9S", "7C 8C 9C", "10S JS QC", "10C JC"],
    });
    expect(solve(stuck).result).toBe("lose");
  });

  it("stops at the node budget", () => {
    const res = solve(deal("budget"), { maxNodes: 1 });
    expect(res.result).toBe("unknown");
    expect(res.moves).toEqual([]);
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
  it("gives a verified-winnable deal for 8 dates, fast", () => {
    const t0 = performance.now();
    for (const date of dates(8)) {
      const daily = dailyDeal(date);
      expect(daily.seed).toMatch(new RegExp(`^freecell:${date}:\\d+$`));
      expect(daily.state).toEqual(deal(daily.seed));
      expect(isWon(replay(daily.state, daily.solution))).toBe(true);
    }
    expect(performance.now() - t0).toBeLessThan(8000);
  }, 30_000);

  it("is the same deal for everyone on a date", () => {
    expect(dailyDeal("2026-10-24")).toEqual(dailyDeal("2026-10-24"));
    expect(dailyDeal("2026-10-24").state).not.toEqual(dailyDeal("2026-10-25").state);
  });

  it("rejects malformed dates", () => {
    expect(() => dailyDeal("24/10/2026")).toThrow();
  });
});
