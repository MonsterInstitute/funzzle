import { describe, expect, it } from "vitest";
import {
  FLOWERS,
  SEASONS,
  TILE_SET,
  applyMatch,
  canMatch,
  dailyDeal,
  freeTiles,
  groupName,
  groupNameOne,
  isFree,
  isStuck,
  isValidState,
  isWon,
  matchCount,
  matchingPairs,
  matchKey,
  newGame,
  remaining,
  shuffleCount,
  shuffleRemaining,
  solve,
  tileName,
  tilesMatch,
  undo,
  type State,
} from "./index";
import { at, board, clears, replay } from "./test-helpers";

describe("tiles", () => {
  it("is the 144-tile set", () => {
    expect(TILE_SET).toHaveLength(144);
    const counts = new Map<string, number>();
    for (const t of TILE_SET) counts.set(t, (counts.get(t) ?? 0) + 1);
    expect(counts.size).toBe(34 + 8);
    for (const [t, n] of counts) expect(n).toBe(t[0] === "f" || matchKey(t) === "s" ? 1 : 4);
  });

  it("names tiles", () => {
    expect(tileName("5b")).toBe("5 Bamboo");
    expect(tileName("7d")).toBe("7 Dots");
    expect(tileName("1c")).toBe("1 Characters");
    expect(tileName("rd")).toBe("Red Dragon");
    expect(tileName("wn")).toBe("North Wind");
    expect(tileName("f1")).toBe("Plum");
    expect(tileName("s3")).toBe("Autumn");
    expect(groupName("rd")).toBe("Red Dragons");
    expect(groupName("7d")).toBe("7 Dots");
    expect(groupName("f3")).toBe("Flowers");
    expect(groupName("s2")).toBe("Seasons");
    expect(groupNameOne("wn")).toBe("North Wind");
    expect(groupNameOne("f2")).toBe("Flower");
    expect(groupNameOne("9c")).toBe("9 Characters");
  });

  it("matches identical tiles, any flower with any flower, any season with any season", () => {
    expect(tilesMatch("5b", "5b")).toBe(true);
    expect(tilesMatch("5b", "5d")).toBe(false);
    expect(tilesMatch("we", "ws")).toBe(false);
    for (const a of FLOWERS) for (const b of FLOWERS) expect(tilesMatch(a, b)).toBe(true);
    for (const a of SEASONS) for (const b of SEASONS) expect(tilesMatch(a, b)).toBe(true);
    expect(tilesMatch("f1", "s1")).toBe(false);
    expect(tilesMatch("s1", "ws")).toBe(false);
  });
});

describe("free tiles", () => {
  const start = newGame("turtle", TILE_SET.slice());

  it("frees only uncovered tiles with an open side", () => {
    expect(isFree(start, at("turtle", 13, 7, 4))).toBe(true); // the top tile
    expect(isFree(start, at("turtle", 12, 6, 3))).toBe(false); // under it
    expect(isFree(start, at("turtle", 0, 7, 0))).toBe(true); // left end
    expect(isFree(start, at("turtle", 2, 6, 0))).toBe(false); // blocked on both sides
    expect(isFree(start, at("turtle", 2, 0, 0))).toBe(true); // end of the top row
    expect(isFree(start, at("turtle", 4, 0, 0))).toBe(false);
    expect(isFree(start, at("turtle", 8, 2, 1))).toBe(true); // end of a raised row
    expect(isFree(start, at("turtle", 8, 4, 0))).toBe(false); // covered by the raised row
    expect(freeTiles(start)).toHaveLength(1 + 8 + 12 + 14);
  });

  it("opens tiles as their neighbours and covers go", () => {
    const top = at("turtle", 13, 7, 4);
    const end = at("turtle", 0, 7, 0);
    const s: State = { ...start, removed: start.removed.slice() };
    s.removed[top] = true;
    s.removed[end] = true;
    for (const [x, y] of [
      [12, 6],
      [14, 6],
      [12, 8],
      [14, 8],
    ]) {
      expect(isFree(s, at("turtle", x, y, 3))).toBe(true);
    }
    // Both rows next to the end tile open up on their left.
    expect(isFree(s, at("turtle", 2, 6, 0))).toBe(true);
    expect(isFree(s, at("turtle", 2, 8, 0))).toBe(true);
    expect(isFree(s, top)).toBe(false); // removed tiles are not free
  });
});

describe("matching", () => {
  // Pyramid peak: two tiles on z4 over the middle of the z3 row.
  const s = board("pyramid", {
    "6,6,3": "f1",
    "8,6,3": "7d",
    "10,6,3": "7d",
    "12,6,3": "f4",
    "8,6,4": "rd",
    "10,6,4": "rd",
  });
  const p = (x: number, z: number) => at("pyramid", x, 6, z);

  it("lists free matching pairs, flowers included", () => {
    expect(matchingPairs(s)).toEqual(
      [
        [p(6, 3), p(12, 3)],
        [p(8, 4), p(10, 4)],
      ].sort((a, b) => a[0] - b[0]),
    );
  });

  it("applies a match, keeps history and undoes it", () => {
    const next = applyMatch(s, [p(8, 4), p(10, 4)]);
    expect(remaining(next)).toBe(4);
    expect(next.history).toEqual([{ kind: "match", pair: [p(8, 4), p(10, 4)] }]);
    expect(s.removed[p(8, 4)]).toBe(false); // the old state is untouched
    expect(canMatch(next, [p(8, 3), p(10, 3)])).toBe(false); // middle of a row
    const flowers = applyMatch(next, [p(6, 3), p(12, 3)]);
    expect(canMatch(flowers, [p(8, 3), p(10, 3)])).toBe(true);
    const won = applyMatch(flowers, [p(8, 3), p(10, 3)]);
    expect(isWon(won)).toBe(true);
    expect(matchCount(won)).toBe(3);
    expect(undo(undo(undo(won)))).toEqual(s);
    expect(undo(s)).toBe(s);
  });

  it("rejects illegal matches", () => {
    expect(() => applyMatch(s, [p(8, 3), p(10, 3)])).toThrow(/not free/);
    expect(() => applyMatch(s, [p(6, 3), p(8, 4)])).toThrow(/do not match/);
    expect(() => applyMatch(s, [p(6, 3), p(6, 3)])).toThrow(/same tile/);
    expect(() => applyMatch(s, [-1, 500])).toThrow(/bad position/);
  });

  it("detects a stuck board", () => {
    const stuck = board("pyramid", { "8,6,3": "7d", "8,6,4": "7d" });
    expect(isStuck(stuck)).toBe(true);
    expect(isStuck(s)).toBe(false);
    expect(solve(stuck).result).toBe("lose");
    // No arrangement of two stacked tiles can be cleared.
    expect(shuffleRemaining(stuck, "x")).toBeNull();
  });

  it("round-trips through JSON", () => {
    const next = applyMatch(s, [p(8, 4), p(10, 4)]);
    const copy = JSON.parse(JSON.stringify(next));
    expect(copy).toEqual(next);
    expect(isValidState(copy)).toBe(true);
    expect(isValidState({ ...copy, layout: "nope" })).toBe(false);
    expect(isValidState({ ...copy, tiles: copy.tiles.slice(1) })).toBe(false);
  });

  it("validates new games", () => {
    expect(() => newGame("quick", TILE_SET.slice())).toThrow();
    expect(() => newGame("quick", TILE_SET.slice(0, 71).concat("zz"))).toThrow();
  });
});

describe("shuffleRemaining", () => {
  const sortTiles = (s: State) =>
    s.tiles
      .filter((_, p) => !s.removed[p])
      .slice()
      .sort();

  for (const layout of ["turtle", "quick", "bridge"] as const) {
    it(`deals the remaining ${layout} tiles into a solvable position`, () => {
      const daily = dailyDeal("2026-10-24", layout);
      for (const k of [0, 10, 25]) {
        const mid = replay(daily.state, daily.solution.slice(0, k));
        const res = shuffleRemaining(mid, `shuffle:${k}`)!;
        expect(res).not.toBeNull();
        expect(sortTiles(res.state)).toEqual(sortTiles(mid));
        expect(res.state.removed).toEqual(mid.removed);
        expect(clears(res.state, res.solution)).toBe(true);
        expect(shuffleCount(res.state)).toBe(1);
        expect(undo(res.state)).toEqual(mid);
        expect(shuffleRemaining(mid, `shuffle:${k}`)).toEqual(res);
      }
    });
  }
});
