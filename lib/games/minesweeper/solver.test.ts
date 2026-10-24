import { describe, expect, it } from "vitest";
import { nextDeduction, solvableWithoutGuessing, solveLayout } from "./solver";
import { at, position } from "./testkit";

/*
 * Hand-made positions where exactly the technique under test is the easiest
 * one that applies. Pictures: * mine, F flagged mine, # hidden safe, . opened.
 */
describe("technique detection", () => {
  it("single-flag: a number with exactly as many hidden cells as mines", () => {
    const s = position([".*#", "..."]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("single-flag");
    expect(d).toMatchObject({ cell: 1, kind: "mine", mines: [1], safe: [], clues: [0] });
  });

  it("single-safe: a number that already touches all its flags", () => {
    const s = position([".F#", "..."]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("single-safe");
    expect(d).toMatchObject({ cell: 2, kind: "safe", safe: [2], clues: [at(s, 1, 1)] });
  });

  it("1-1 pattern against a wall", () => {
    const s = position(["*##*", "...."]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("1-1 pattern");
    expect(d.safe).toEqual([2]);
    expect(d.clues).toEqual([at(s, 1, 1), at(s, 1, 0)]);
  });

  it("subset: the extra cells of the bigger number hold its extra mines", () => {
    const s = position(["*#*", "..."]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("subset");
    expect(d).toMatchObject({ kind: "mine", mines: [2], safe: [] });
  });

  it("mine count: all mines flagged", () => {
    const s = position([".F###"]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("mine count");
    expect(d.safe).toEqual([2, 3, 4]);
  });

  it("mine count: the edge needs every mine left, so the interior is safe", () => {
    const s = position(["*.###"]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("mine count");
    expect(d.safe).toEqual([3, 4]);
    expect(d.mines).toEqual([]);
  });

  it("1-2 pattern: the bigger number can't fit its mines in the shared cells", () => {
    // The 1 at (0,1) and the 3 at (0,2) share two hidden cells, which hold at most one mine.
    const s = position(["#..*#", "#*#*#", ".*..."]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("1-2 pattern");
    expect(d).toMatchObject({ cell: 0, kind: "safe", safe: [0, 5], mines: [3, 8], clues: [1, 2] });
  });

  it("frontier enumeration finds what no pair can", () => {
    const s = position(["*.#.*", "**.##", "*#*.*"]);
    const d = nextDeduction(s)!;
    expect(d.technique).toBe("frontier enumeration");
    expect(d.mines).toEqual([0, 5]);
    expect(d.clues).toEqual([1, 3, 7, 13]);
  });

  it("returns null on a true 50/50 and for finished games", () => {
    const s = position(["*#", "..", ".."]);
    expect(nextDeduction(s)).toBeNull();
    expect(nextDeduction({ ...position([".F#", "..."]), status: "won" })).toBeNull();
  });
});

describe("solvableWithoutGuessing", () => {
  it("rejects a forced 50/50 and accepts a logical board", () => {
    const fifty = position(["*#", "##", "##"]);
    expect(solvableWithoutGuessing(fifty, at(fifty, 2, 0))).toBe(false);
    const fine = position(["*##", "###", "###"]);
    expect(solvableWithoutGuessing(fine, 8)).toBe(true);
    const r = solveLayout(fine, 8);
    expect(r.solved).toBe(true);
    expect(r.revealed.filter(Boolean)).toHaveLength(8);
  });

  it("refuses a first click on a mine", () => {
    const s = position(["*##", "###", "###"]);
    expect(solvableWithoutGuessing(s, 0)).toBe(false);
  });
});
