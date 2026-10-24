import { describe, expect, it } from "vitest";
import { generateSudoku } from "@/lib/games/sudoku";
import { currentGrid, initialState, isComplete, reducer, remaining, solveOrderMap } from "@/components/sudoku/state";

const p = generateSudoku("test:state", "medium");
const empty = p.puzzle.findIndex((v) => !v);
const fresh = () => initialState(p.puzzle, p.solution);

describe("sudoku play state", () => {
  it("counts a wrong entry as a mistake and keeps it visible", () => {
    const wrong = p.solution[empty] === 9 ? 1 : p.solution[empty] + 1;
    const s = reducer(fresh(), { type: "input", cell: empty, digit: wrong, at: 1000 });
    expect(s.mistakes).toBe(1);
    expect(currentGrid(s)[empty]).toBe(wrong);
    expect(s.order[empty]).toBe(0);
  });

  it("locks correct entries, records solve order, and clears peer notes", () => {
    const peer = p.puzzle.findIndex((v, i) => !v && i !== empty && Math.floor(i / 9) === Math.floor(empty / 9));
    let s = reducer(fresh(), { type: "note", cell: peer, digit: p.solution[empty] });
    expect(s.notes[peer]).toBe(1 << (p.solution[empty] - 1));
    s = reducer(s, { type: "input", cell: empty, digit: p.solution[empty], at: 4200 });
    expect(s.order[empty]).toBe(1);
    expect(s.placedAt[empty]).toBe(4200);
    expect(s.notes[peer]).toBe(0);
    // A correct digit can't be overwritten or erased.
    expect(reducer(s, { type: "input", cell: empty, digit: 1, at: 5000 }).values[empty]).toBe(p.solution[empty]);
    expect(reducer(s, { type: "erase", cell: empty }).values[empty]).toBe(p.solution[empty]);
  });

  it("never edits givens", () => {
    const given = p.puzzle.findIndex((v) => v);
    const s = fresh();
    expect(reducer(s, { type: "input", cell: given, digit: 1, at: 0 })).toBe(s);
    expect(reducer(s, { type: "note", cell: given, digit: 1 })).toBe(s);
  });

  it("undo and redo walk the history", () => {
    let s = reducer(fresh(), { type: "input", cell: empty, digit: p.solution[empty], at: 0 });
    s = reducer(s, { type: "undo" });
    expect(s.values[empty]).toBe(0);
    s = reducer(s, { type: "redo" });
    expect(s.values[empty]).toBe(p.solution[empty]);
    expect(reducer(fresh(), { type: "undo" }).past).toHaveLength(0);
  });

  it("coach placements don't count as mistakes and are remembered", () => {
    const s = reducer(fresh(), { type: "coach-place", cell: empty, digit: p.solution[empty], at: 0 });
    expect(s.coached).toEqual([empty]);
    expect(s.mistakes).toBe(0);
  });

  it("detects completion, digit counts and the share map", () => {
    let s = fresh();
    expect(remaining(s).slice(1).reduce((a, b) => a + b, 0)).toBe(81 - p.givens);
    p.puzzle.forEach((v, i) => {
      if (!v) s = reducer(s, { type: "input", cell: i, digit: p.solution[i], at: i });
    });
    expect(isComplete(s)).toBe(true);
    expect(remaining(s).slice(1).every((n) => n === 0)).toBe(true);
    const map = solveOrderMap(s);
    expect(map).toMatch(/^[0-4]{81}$/);
    expect([...map].filter((c) => c === "0")).toHaveLength(p.givens);
    expect(map[empty]).toBe("1");
  });
});
