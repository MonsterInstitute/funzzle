import { describe, expect, it } from "vitest";
import { generateKakuro } from "@/lib/games/kakuro";
import { boardFor, emptyCells, initialState, isComplete, moveCursor, peers, reducer, runDone } from "@/components/kakuro/state";

const p = generateKakuro("test:state", "easy");
const fresh = () => initialState(p);
const cell = p.layout.indexOf(".");
const board = boardFor(p);

describe("kakuro play state", () => {
  it("counts a wrong entry as a mistake and keeps it visible", () => {
    const wrong = p.solution[cell] === 9 ? 1 : p.solution[cell] + 1;
    const s = reducer(fresh(), { type: "input", cell, digit: wrong, at: 1000 });
    expect(s.mistakes).toBe(1);
    expect(s.values[cell]).toBe(wrong);
    expect(s.order[cell]).toBe(0);
  });

  it("locks correct entries, records solve order, and clears run-mates' notes", () => {
    const mate = peers(p, cell)[0];
    let s = reducer(fresh(), { type: "note", cell: mate, digit: p.solution[cell] });
    expect(s.notes[mate]).toBe(1 << (p.solution[cell] - 1));
    s = reducer(s, { type: "input", cell, digit: p.solution[cell], at: 4200 });
    expect(s.order[cell]).toBe(1);
    expect(s.placedAt[cell]).toBe(4200);
    expect(s.notes[mate]).toBe(0);
    expect(reducer(s, { type: "input", cell, digit: 1, at: 5000 }).values[cell]).toBe(p.solution[cell]);
    expect(reducer(s, { type: "erase", cell }).values[cell]).toBe(p.solution[cell]);
  });

  it("never edits clue cells", () => {
    const s = fresh();
    expect(reducer(s, { type: "input", cell: 0, digit: 1, at: 0 })).toBe(s);
    expect(reducer(s, { type: "note", cell: 0, digit: 1 })).toBe(s);
  });

  it("undo and redo walk the history", () => {
    let s = reducer(fresh(), { type: "input", cell, digit: p.solution[cell], at: 0 });
    s = reducer(s, { type: "undo" });
    expect(s.values[cell]).toBe(0);
    s = reducer(s, { type: "redo" });
    expect(s.values[cell]).toBe(p.solution[cell]);
  });

  it("knows when runs and the board are done", () => {
    let s = fresh();
    const run = board.runs[0];
    for (const i of run.cells) s = reducer(s, { type: "input", cell: i, digit: p.solution[i], at: 0 });
    expect(runDone(s, run.id)).toBe(true);
    for (let i = 0; i < p.layout.length; i++) if (p.layout[i] === ".") s = reducer(s, { type: "input", cell: i, digit: p.solution[i], at: 0 });
    expect(emptyCells(s)).toBe(0);
    expect(isComplete(s)).toBe(true);
  });

  it("moves the cursor over clue cells to the next white cell", () => {
    const W = p.size + 1;
    for (let i = 0; i < p.layout.length; i++) {
      if (p.layout[i] !== ".") continue;
      const right = moveCursor(p, i, 0, 1);
      expect(p.layout[right]).toBe(".");
      expect(Math.floor(right / W)).toBe(Math.floor(i / W));
      expect(right >= i).toBe(true);
    }
  });
});
