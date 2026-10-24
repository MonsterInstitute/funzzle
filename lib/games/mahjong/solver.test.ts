import { beforeEach, describe, expect, it } from "vitest";
import {
  LAYOUT_IDS,
  TILE_SET,
  applyMatch,
  dailyDeal,
  generateDeal,
  isWon,
  knownLine,
  matchKey,
  matchingPairs,
  rememberWinningLine,
  solve,
  type State,
} from "./index";
import { clearKnownLines } from "./solver";
import { board, clears, replay } from "./test-helpers";

beforeEach(() => clearKnownLines());

/** Per match key: the counts in a full set. */
const fullSet = new Map<string, number>();
for (const t of TILE_SET) fullSet.set(matchKey(t), (fullSet.get(matchKey(t)) ?? 0) + 1);

function checkTiles(state: State) {
  const counts = new Map<string, number>();
  const ids = new Map<string, number>();
  for (const t of state.tiles) {
    counts.set(matchKey(t), (counts.get(matchKey(t)) ?? 0) + 1);
    ids.set(t, (ids.get(t) ?? 0) + 1);
  }
  for (const [k, n] of counts) {
    expect(n % 2).toBe(0);
    expect(n).toBeLessThanOrEqual(fullSet.get(k)!);
  }
  for (const [t, n] of ids) expect(n).toBeLessThanOrEqual(TILE_SET.filter((x) => x === t).length);
}

describe("generateDeal", () => {
  for (const layout of LAYOUT_IDS) {
    it(`deals solvable ${layout} boards for several seeds`, () => {
      for (let i = 0; i < 6; i++) {
        const { state, solution } = generateDeal(layout, `gen-test:${layout}:${i}`);
        expect(state.tiles).toHaveLength(state.removed.length);
        expect(state.removed.every((r) => !r)).toBe(true);
        checkTiles(state);
        expect(solution).toHaveLength(state.tiles.length / 2);
        expect(clears(state, solution)).toBe(true);
      }
    });
  }

  it("uses the whole set on the turtle", () => {
    const { state } = generateDeal("turtle", "full-set");
    expect(state.tiles.slice().sort()).toEqual(TILE_SET.slice().sort());
  });

  it("is deterministic", () => {
    expect(generateDeal("turtle", "same")).toEqual(generateDeal("turtle", "same"));
    expect(generateDeal("turtle", "same").state.tiles).not.toEqual(generateDeal("turtle", "other").state.tiles);
  });

  it("generates and verifies a turtle deal in well under a second", () => {
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) {
      const { state, solution } = generateDeal("turtle", `speed:${i}`);
      expect(clears(state, solution)).toBe(true);
    }
    expect((performance.now() - t0) / 10).toBeLessThan(500);
  });
});

describe("solve", () => {
  it("clears quick boards and returns a replayable line", () => {
    for (let i = 0; i < 5; i++) {
      const { state } = generateDeal("quick", `solve-quick:${i}`);
      const res = solve(state);
      expect(res.result).toBe("win");
      expect(clears(state, res.moves)).toBe(true);
    }
  });

  it("clears most full-size boards within its budget", () => {
    let won = 0;
    for (const layout of ["turtle", "fortress"] as const) {
      for (let i = 0; i < 4; i++) {
        const { state } = generateDeal(layout, `solve-big:${i}`);
        const res = solve(state, { maxNodes: 30_000 });
        if (res.result === "win") {
          won++;
          expect(clears(state, res.moves)).toBe(true);
        } else {
          expect(res.result).toBe("unknown");
        }
      }
    }
    expect(won).toBeGreaterThanOrEqual(5);
  }, 20_000);

  it("solves from the middle of a daily deal", () => {
    const daily = dailyDeal("2026-03-03", "turtle");
    const mid = replay(daily.state, daily.solution.slice(0, 50));
    const res = solve(mid);
    expect(res.result).toBe("win");
    expect(clears(mid, res.moves)).toBe(true);
  });

  it("handles the four-of-a-kind choice", () => {
    // Three 7 Dots are free; only matching the top one with the left end keeps the board clearable.
    const s = board("pyramid", {
      "6,6,3": "7d",
      "8,6,3": "rd",
      "10,6,3": "7d",
      "12,6,3": "7d",
      "8,6,4": "7d",
      "10,6,4": "rd",
    });
    const res = solve(s);
    expect(res.result).toBe("win");
    expect(clears(s, res.moves)).toBe(true);
    expect(matchingPairs(s)).toHaveLength(3);
  });

  it("proves crossed stacks lost", () => {
    // Each Red Dragon sits on a 7 Dots, and the other way round on the second stack.
    const s = board("pyramid", {
      "8,6,3": "7d",
      "8,6,4": "rd",
      "10,6,3": "rd",
      "10,6,4": "7d",
    });
    expect(solve(s)).toMatchObject({ result: "lose", moves: [] });
  });

  it("handles won positions and stops at the node budget", () => {
    const daily = dailyDeal("2026-05-05", "turtle");
    expect(solve(replay(daily.state, daily.solution))).toEqual({ result: "win", moves: [], nodes: 0 });
    const res = solve(daily.state, { maxNodes: 1 });
    expect(res.result).toBe("unknown");
    expect(res.nodes).toBeLessThanOrEqual(1);
  });

  it("does not change the state it is given", () => {
    const { state } = generateDeal("pyramid", "immutable");
    const before = JSON.stringify(state);
    solve(state, { maxNodes: 5_000 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("known lines", () => {
  it("are repaired when the player strays from them", () => {
    const daily = dailyDeal("2026-07-01", "turtle");
    let s = daily.state;
    let repaired = 0;
    let tried = 0;
    for (let step = 0; step < 30; step++) {
      const line = knownLine(s)!;
      expect(clears(s, line)).toBe(true);
      // Try every pair that is not the line's next move; keep the first one the line survives.
      let next = applyMatch(s, line[0]);
      for (const other of matchingPairs(s)) {
        if (other[0] === line[0][0] && other[1] === line[0][1]) continue;
        tried++;
        const after = applyMatch(s, other);
        const fixed = knownLine(after);
        if (fixed) {
          expect(clears(after, fixed)).toBe(true);
          repaired++;
          next = after;
          break;
        }
      }
      s = next;
    }
    expect(repaired).toBeGreaterThanOrEqual(15);
    expect(tried).toBeGreaterThan(repaired);
  });

  it("rejects wrong lines", () => {
    const { state, solution } = generateDeal("quick", "wrong-line");
    expect(rememberWinningLine(state, solution.slice(1))).toBe(false);
    expect(rememberWinningLine(state, solution)).toBe(true);
    expect(knownLine(state)).toEqual(solution);
  });
});

describe("dailyDeal", () => {
  it("gives a verified deal for every layout", () => {
    for (const layout of LAYOUT_IDS) {
      for (const date of ["2026-01-01", "2026-10-24"]) {
        const daily = dailyDeal(date, layout);
        expect(daily.seed).toMatch(new RegExp(`^mahjong:${date}:${layout}:\\d+$`));
        expect(daily.state).toEqual(generateDeal(layout, daily.seed).state);
        expect(isWon(replay(daily.state, daily.solution))).toBe(true);
      }
    }
  });

  it("is the same deal for everyone on a date", () => {
    expect(dailyDeal("2026-10-24")).toEqual(dailyDeal("2026-10-24", "turtle"));
    expect(dailyDeal("2026-10-24").state.tiles).not.toEqual(dailyDeal("2026-10-25").state.tiles);
  });

  it("rejects bad input", () => {
    expect(() => dailyDeal("24/10/2026")).toThrow();
    expect(() => dailyDeal("2026-10-24", "spiral" as never)).toThrow();
  });
});
