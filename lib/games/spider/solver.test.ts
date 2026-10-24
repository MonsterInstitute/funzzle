import { beforeEach, describe, expect, it } from "vitest";
import { dailyDeal, deal, isLegal, isWon, knownLine, rememberWinningLine, solve } from "./index";
import { clearKnownLines } from "./solver";
import { build, replay, run, wins } from "./test-helpers";

beforeEach(() => clearKnownLines());

/** Test dates spread over a year. */
const dates = (n: number, start = Date.UTC(2026, 0, 1), step = 17) =>
  Array.from({ length: n }, (_, i) => new Date(start + i * step * 86_400_000).toISOString().slice(0, 10));

describe("solve", () => {
  it("returns replayable winning lines for most 1-suit deals", () => {
    let won = 0;
    for (let i = 0; i < 12; i++) {
      const state = deal(`solve-test:${i}`, 1);
      const res = solve(state, { maxNodes: 20_000 });
      expect(["win", "unknown", "lose"]).toContain(res.result);
      if (res.result === "win") {
        won++;
        expect(wins(state, res.moves)).toBe(true);
      } else {
        expect(res.moves).toEqual([]);
      }
    }
    expect(won).toBeGreaterThanOrEqual(7);
  }, 30_000);

  it("returns replayable winning lines for 2-suit deals", () => {
    let won = 0;
    for (let i = 0; i < 6; i++) {
      const state = deal(`solve-test-2:${i}`, 2);
      const res = solve(state, { maxNodes: 60_000 });
      if (res.result === "win") {
        won++;
        expect(wins(state, res.moves)).toBe(true);
      }
    }
    expect(won).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it("solves from a mid-game position", () => {
    const { state, solution } = dailyDeal("2026-03-03", 2);
    const mid = replay(state, solution.slice(0, 60));
    const res = solve(mid, { maxNodes: 60_000 });
    expect(res.result).toBe("win");
    expect(isLegal(mid, res.moves[0])).toBe(true);
    expect(wins(mid, res.moves)).toBe(true);
  }, 30_000);

  it("handles won, nearly won and stuck positions", () => {
    expect(solve(build({ foundations: "S S H H D D C C" }))).toEqual({ result: "win", moves: [], nodes: 0 });

    const near = build({ tableau: ["|" + run("S", 13, 3), "|2S", "|AS"], foundations: "H" });
    const res = solve(near);
    expect(res.result).toBe("win");
    expect(res.moves).toHaveLength(2);
    expect(wins(near, res.moves)).toBe(true);

    // Eight Kings and two Jacks over hidden cards, nothing in the stock: no move at all.
    const kings = ["KS", "KH", "KD", "KC", "KS", "KH", "KD", "KC", "JS", "JH"].map((t, i) => `${i + 2}D|${t}`);
    expect(solve(build({ tableau: kings })).result).toBe("lose");
  });

  it("plays through a deal from the stock", () => {
    // The 2♠ and A♠ only arrive with the deal, along with the low hearts.
    const tableau = ["|" + run("S", 13, 3), ...run("H", 13, 5).split(" ").map((x) => "|" + x)];
    const s = build({ tableau, stock: "AS AH 2H 3H 4H 2S" });
    const res = solve(s);
    expect(res.result).toBe("win");
    expect(res.moves[0]).toEqual({ kind: "deal" });
    expect(wins(s, res.moves)).toBe(true);
  });

  it("stops at the node budget", () => {
    const res = solve(deal("budget", 2), { maxNodes: 1 });
    expect(res.result).toBe("unknown");
    expect(res.nodes).toBeLessThanOrEqual(1);
  });

  it("does not change the state it is given", () => {
    const state = deal("immutable", 2);
    const before = JSON.stringify(state);
    solve(state, { maxNodes: 5_000 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("dailyDeal", () => {
  it("gives a verified-winnable 1-suit deal for 10 dates", () => {
    for (const date of dates(10)) {
      const daily = dailyDeal(date, 1);
      expect(daily.seed).toMatch(new RegExp(`^spider:${date}:1:\\d+$`));
      expect(daily.state).toEqual(deal(daily.seed, 1));
      expect(isWon(replay(daily.state, daily.solution))).toBe(true);
    }
  }, 30_000);

  it("gives a verified-winnable 2-suit deal for 5 dates", () => {
    for (const date of dates(5, Date.UTC(2026, 9, 20), 3)) {
      const daily = dailyDeal(date, 2);
      expect(daily.seed).toMatch(new RegExp(`^spider:${date}:2:\\d+$`));
      expect(daily.state.suits).toBe(2);
      expect(isWon(replay(daily.state, daily.solution))).toBe(true);
    }
  }, 30_000);

  it("can verify a 4-suit deal (one known-fast date; 4 suits average ~5 s, see DAILY_BUDGET)", () => {
    const daily = dailyDeal("2026-10-05", 4);
    expect(daily.seed).toBe("spider:2026-10-05:4:0");
    expect(isWon(replay(daily.state, daily.solution))).toBe(true);
  }, 30_000);

  it("is the same deal for everyone on a date", () => {
    const a = dailyDeal("2026-10-24", 2);
    const b = dailyDeal("2026-10-24", 2);
    expect(b.seed).toBe(a.seed);
    expect(b.state).toEqual(a.state);
    expect(b.solution).toEqual(a.solution);
    expect(dailyDeal("2026-10-25", 2).state).not.toEqual(a.state);
    expect(dailyDeal("2026-10-24", 1).state).not.toEqual(a.state);
  }, 30_000);

  it("rejects malformed dates", () => {
    expect(() => dailyDeal("24/10/2026")).toThrow();
  });
});

describe("winning lines", () => {
  it("remembers solutions and checks lines it is taught", () => {
    const { state, solution } = dailyDeal("2026-06-01", 1);
    expect(knownLine(state)).toEqual(solution);
    expect(knownLine(replay(state, solution.slice(0, 5)))).toEqual(solution.slice(5));

    clearKnownLines();
    expect(knownLine(state)).toBeUndefined();
    expect(rememberWinningLine(state, solution.slice(0, -1))).toBe(false);
    expect(rememberWinningLine(state, [{ kind: "move", from: 0, to: 0, count: 1 }])).toBe(false);
    expect(knownLine(state)).toBeUndefined();
    expect(rememberWinningLine(state, solution)).toBe(true);
    expect(knownLine(state)).toEqual(solution);
  });
});
