import { describe, expect, it } from "vitest";
import { EMPTY, FILLED, UNKNOWN, generateNonogram } from "@/lib/games/nonogram";
import { initialState, isComplete, lineDone, reducer, remainingFills, strokeLine, strokeTargets, strokeValue } from "@/components/nonogram/state";

const p = generateNonogram("test:state", 10);
const fresh = () => initialState(10, p.solution, p.clues);
const filledCell = p.solution.findIndex((v) => v === 1);
const emptyCell = p.solution.findIndex((v) => v === 0);

describe("nonogram play state", () => {
  it("counts wrong marks as mistakes, both ways", () => {
    let s = reducer(fresh(), { type: "paint", cells: [emptyCell], value: FILLED });
    expect(s.mistakes).toBe(1);
    s = reducer(s, { type: "paint", cells: [filledCell], value: EMPTY });
    expect(s.mistakes).toBe(2);
    // Correct marks and clearing are free.
    s = reducer(s, { type: "paint", cells: [filledCell], value: FILLED });
    s = reducer(s, { type: "paint", cells: [emptyCell], value: UNKNOWN });
    expect(s.mistakes).toBe(2);
  });

  it("ignores a stroke that changes nothing", () => {
    const s = fresh();
    expect(reducer(s, { type: "paint", cells: [0], value: UNKNOWN })).toBe(s);
  });

  it("undo and redo walk the history", () => {
    let s = reducer(fresh(), { type: "paint", cells: [filledCell], value: FILLED });
    s = reducer(s, { type: "undo" });
    expect(s.cells[filledCell]).toBe(UNKNOWN);
    s = reducer(s, { type: "redo" });
    expect(s.cells[filledCell]).toBe(FILLED);
    expect(s.future).toHaveLength(0);
  });

  it("is complete when exactly the picture is filled, crosses optional", () => {
    let s = fresh();
    const fills = p.solution.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    s = reducer(s, { type: "paint", cells: fills, value: FILLED });
    expect(remainingFills(s)).toBe(0);
    expect(isComplete(s)).toBe(true);
    s = reducer(s, { type: "paint", cells: [emptyCell], value: FILLED });
    expect(isComplete(s)).toBe(false);
  });

  it("applies the coach's cells and remembers them", () => {
    const s = reducer(fresh(), { type: "coach", fill: [filledCell], empty: [emptyCell] });
    expect(s.cells[filledCell]).toBe(FILLED);
    expect(s.cells[emptyCell]).toBe(EMPTY);
    expect(s.coached.sort()).toEqual([filledCell, emptyCell].sort());
    expect(s.mistakes).toBe(0);
  });

  it("dims a line once its fills match the clue", () => {
    const row = p.solution.slice(0, 10).map((v, c) => (v ? c : -1)).filter((c) => c >= 0);
    let s = fresh();
    expect(lineDone(s, { kind: "row", index: 0 })).toBe(p.clues.rows[0].length === 0);
    s = reducer(s, { type: "paint", cells: row, value: FILLED });
    expect(lineDone(s, { kind: "row", index: 0 })).toBe(true);
  });
});

describe("strokes", () => {
  it("locks a drag to the start's row or column", () => {
    expect(strokeLine(12, 15, 10)).toEqual([12, 13, 14, 15]);
    expect(strokeLine(15, 12, 10)).toEqual([15, 14, 13, 12]);
    expect(strokeLine(12, 42, 10)).toEqual([12, 22, 32, 42]);
    // Mostly sideways with a little drift stays on the row.
    expect(strokeLine(12, 25, 10)).toEqual([12, 13, 14, 15]);
  });

  it("toggles in the current mode", () => {
    expect(strokeValue("fill", UNKNOWN)).toBe(FILLED);
    expect(strokeValue("fill", FILLED)).toBe(UNKNOWN);
    expect(strokeValue("fill", EMPTY)).toBe(FILLED);
    expect(strokeValue("cross", UNKNOWN)).toBe(EMPTY);
    expect(strokeValue("cross", EMPTY)).toBe(UNKNOWN);
  });

  it("paints blanks only, and clears only the kind of mark it started on", () => {
    const cells = [UNKNOWN, EMPTY, UNKNOWN, FILLED, UNKNOWN];
    expect(strokeTargets(cells, [0, 1, 2, 3, 4], FILLED)).toEqual([0, 2, 4]);
    const marked = [FILLED, FILLED, EMPTY, FILLED, UNKNOWN];
    expect(strokeTargets(marked, [0, 1, 2, 3, 4], UNKNOWN)).toEqual([0, 1, 3]);
  });
});
