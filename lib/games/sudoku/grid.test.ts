import { describe, expect, it } from "vitest";
import { candidates, conflicts, countSolutions, isSolved, solve, digitsOf, type Grid } from "./grid";

/** A classic puzzle with a single solution. */
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const parse = (s: string): Grid => [...s].map(Number);

describe("grid basics", () => {
  it("computes candidates from row, column and box", () => {
    const cand = candidates(parse(PUZZLE));
    expect(cand[0]).toBe(0);
    // R1C3: row has 3,5,7; column has 8; box has 3,5,6,8,9 -> {1,2,4}.
    expect(digitsOf(cand[2])).toEqual([1, 2, 4]);
    expect(candidates(new Array(81).fill(0)).every((m) => m === 0x1ff)).toBe(true);
  });

  it("finds conflicting cells", () => {
    expect(conflicts(parse(PUZZLE))).toEqual([]);
    const g = parse(PUZZLE);
    g[2] = 5; // clashes with R1C1 (row and box)
    expect(conflicts(g)).toEqual([0, 2]);
    const h = new Array(81).fill(0);
    h[0] = 4;
    h[80] = 4; // different row, column and box: fine
    h[72] = 4; // same column as R1C1 and same row as R9C9
    expect(conflicts(h)).toEqual([0, 72, 80]);
  });

  it("counts and finds solutions", () => {
    expect(countSolutions(parse(PUZZLE))).toBe(1);
    expect(solve(parse(PUZZLE))?.join("")).toBe(SOLUTION);
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
    expect(countSolutions(new Array(81).fill(0), 5)).toBe(5);
    const bad = parse(PUZZLE);
    bad[2] = 5;
    expect(countSolutions(bad)).toBe(0);
    expect(solve(bad)).toBeNull();
  });

  it("checks a finished grid against the solution", () => {
    expect(isSolved(parse(SOLUTION), parse(SOLUTION))).toBe(true);
    expect(isSolved(parse(PUZZLE), parse(SOLUTION))).toBe(false);
  });
});
