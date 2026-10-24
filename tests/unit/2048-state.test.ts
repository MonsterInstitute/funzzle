import { describe, expect, it } from "vitest";
import { legalMoves, type State, type Tile } from "@/lib/games/t2048";
import { canUndo, cornerShare, initialState, reducer, skillsFor, stuck, undosLeft, type PlayState } from "@/components/t2048/state";

function withBoard(cells: number[]): PlayState {
  const tiles: Tile[] = [];
  cells.forEach((v, cell) => v && tiles.push({ id: tiles.length + 1, v, cell, born: 0 }));
  const game: State = { seed: "t", tiles, nextId: tiles.length + 1, score: 0, moves: 0 };
  return { ...initialState("t"), game };
}

describe("2048 play state", () => {
  it("one free undo, then only after a granted (rewarded) undo", () => {
    let s = initialState("undo");
    s = reducer(s, { type: "move", dir: legalMoves(s.game)[0], at: 100 });
    s = reducer(s, { type: "move", dir: legalMoves(s.game)[0], at: 200 });
    expect(undosLeft(s)).toBe(1);
    const afterTwo = s.game;
    s = reducer(s, { type: "undo" });
    expect(s.game.moves).toBe(1);
    expect(undosLeft(s)).toBe(0);
    expect(canUndo(s)).toBe(false);
    // No second undo without the ad.
    expect(reducer(s, { type: "undo" }).game.moves).toBe(1);
    s = reducer(s, { type: "grant-undo" });
    expect(canUndo(s)).toBe(true);
    s = reducer(s, { type: "undo" });
    expect(s.game.moves).toBe(0);
    expect(s.undosUsed).toBe(2);
    // Redoing the same move gives the same tiles: undo can't fish for spawns.
    s = reducer(s, { type: "move", dir: legalMoves(s.game)[0], at: 300 });
    s = reducer(s, { type: "move", dir: legalMoves(s.game)[0], at: 400 });
    expect(s.game.tiles.map((t) => [t.cell, t.v]).sort()).toEqual(afterTwo.tiles.map((t) => [t.cell, t.v]).sort());
  });

  it("ignores moves that change nothing", () => {
    const s = withBoard([3, 2, 1, 0, ...new Array(12).fill(0)]);
    expect(reducer(s, { type: "move", dir: "left", at: 0 })).toBe(s);
  });

  it("records when a big tile first appears", () => {
    const s = reducer(withBoard([6, 6, 0, 0, ...new Array(12).fill(0)]), { type: "move", dir: "left", at: 4200 });
    expect(s.reached[7]).toEqual({ move: 1, at: 4200 });
    expect(s.game.score).toBe(128);
  });

  it("tracks the corner and stops after the end", () => {
    let s = withBoard([0, 7, 1, 0, ...new Array(12).fill(0)]);
    s = reducer(s, { type: "move", dir: "left", at: 0 });
    expect(s.bigMoves).toBe(1);
    expect(cornerShare(s)).toBe(1);
    s = reducer(s, { type: "end" });
    expect(reducer(s, { type: "move", dir: "down", at: 0 })).toBe(s);
  });

  it("knows a stuck board", () => {
    expect(stuck(withBoard([1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]))).toBe(true);
    expect(stuck(initialState("x"))).toBe(false);
  });

  it("earns tile skills, and no-undo only without undo or hints", () => {
    const s = withBoard([10, 0, 0, 0, ...new Array(12).fill(0)]);
    expect(skillsFor(s)).toEqual(expect.arrayContaining(["reach-256", "reach-512", "reach-1024", "no-undo-1024"]));
    expect(skillsFor({ ...s, hints: 1 })).not.toContain("no-undo-1024");
    expect(skillsFor({ ...s, bigMoves: 120, cornerMoves: 110 })).toContain("corner");
    expect(skillsFor({ ...s, bigMoves: 120, cornerMoves: 50 })).not.toContain("corner");
  });
});
