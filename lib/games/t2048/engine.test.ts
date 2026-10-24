import { describe, expect, it } from "vitest";
import { boardOf, daily2048, isOver, legalMoves, move, newGame, slide, type State, type Tile } from "./index";

/** A state from a board of exponents (0 = empty). */
export function stateOf(cells: number[], seed = "test"): State {
  const tiles: Tile[] = [];
  cells.forEach((v, cell) => v && tiles.push({ id: tiles.length + 1, v, cell, born: 0 }));
  return { seed, tiles, nextId: tiles.length + 1, score: 0, moves: 0 };
}
const row = (r: number[]) => [...r, ...new Array(12).fill(0)];
const firstRow = (s: { tiles: Tile[] }) => {
  const b = new Array(16).fill(0);
  for (const t of s.tiles) b[t.cell] = t.v;
  return b.slice(0, 4);
};

describe("2048 slide and merge", () => {
  it("merges [2,2,2,2] into [4,4], not [8]", () => {
    const r = slide(stateOf(row([1, 1, 1, 1])), "left");
    expect(firstRow(r)).toEqual([2, 2, 0, 0]);
    expect(r.gained).toBe(8);
  });
  it("never merges a tile twice in one move", () => {
    expect(firstRow(slide(stateOf(row([2, 1, 1, 0])), "left"))).toEqual([2, 2, 0, 0]);
    expect(firstRow(slide(stateOf(row([1, 1, 2, 0])), "left"))).toEqual([2, 2, 0, 0]);
  });
  it("merges the pair nearest the wall first", () => {
    expect(firstRow(slide(stateOf(row([1, 1, 1, 0])), "right"))).toEqual([0, 0, 1, 2]);
    expect(firstRow(slide(stateOf(row([1, 1, 1, 0])), "left"))).toEqual([2, 1, 0, 0]);
  });
  it("compacts across gaps and keeps tile ids", () => {
    const s = stateOf(row([0, 3, 0, 3]));
    const r = slide(s, "left");
    expect(firstRow(r)).toEqual([4, 0, 0, 0]);
    expect(r.tiles).toHaveLength(1);
    expect(s.tiles.map((t) => t.id)).toContain(r.tiles[0].id);
    expect(r.merged).toEqual([4]);
  });
  it("slides columns up and down", () => {
    const cells = new Array(16).fill(0);
    cells[0] = 1;
    cells[8] = 1;
    cells[12] = 2;
    const up = slide(stateOf(cells), "up");
    const b = new Array(16).fill(0);
    for (const t of up.tiles) b[t.cell] = t.v;
    expect([b[0], b[4], b[8], b[12]]).toEqual([2, 2, 0, 0]);
  });
  it("a move that changes nothing is not a move", () => {
    expect(move(stateOf(row([3, 2, 1, 0])), "left")).toBeNull();
  });
});

describe("2048 seeded spawns", () => {
  it("the start position and every spawn are a function of seed and move count", () => {
    const a = newGame("2048:2026-10-24");
    const b = newGame("2048:2026-10-24");
    expect(a).toEqual(b);
    expect(a.tiles).toHaveLength(2);
    let x: State = a;
    let y: State = b;
    for (const d of ["left", "up", "right", "down", "left", "up"] as const) {
      x = move(x, d) ?? x;
      y = move(y, d) ?? y;
    }
    expect(boardOf(x)).toEqual(boardOf(y));
    expect(newGame("2048:2026-10-25")).not.toEqual(a);
  });
  it("an undo followed by the same move brings back the same tile", () => {
    const s = newGame("undo-test");
    const d = legalMoves(s)[0];
    expect(boardOf(move(s, d)!)).toEqual(boardOf(move(s, d)!));
  });
  it("adds exactly one tile per move and counts moves and score", () => {
    const s = stateOf(row([1, 1, 0, 0]));
    const n = move(s, "left")!;
    expect(n.tiles).toHaveLength(2);
    expect(n.moves).toBe(1);
    expect(n.score).toBe(4);
  });
  it("the daily is the same for everyone", () => {
    expect(daily2048("2026-10-24")).toEqual(daily2048("2026-10-24"));
    expect(daily2048("2026-10-24").start.filter(Boolean)).toHaveLength(2);
  });
});

describe("2048 game over", () => {
  it("a full board with no equal neighbours is over", () => {
    const full = [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
    expect(isOver(stateOf(full))).toBe(true);
    expect(legalMoves(stateOf(full))).toEqual([]);
  });
  it("a full board with a merge left is not over", () => {
    const full = [1, 1, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1];
    expect(isOver(stateOf(full))).toBe(false);
  });
});
