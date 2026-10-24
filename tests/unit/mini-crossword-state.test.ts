import { describe, expect, it } from "vitest";
import { MINI_BANK, layoutOf } from "@/lib/games/mini";
import {
  afterType,
  arrow,
  backTarget,
  entryAt,
  entryStart,
  initialState,
  isClean,
  isComplete,
  isFull,
  reducer,
  solveOrderMap,
  stepEntry,
  type PlayState,
} from "@/components/mini/state";

// b01: AFAR# / DODO# / SCOUT / #URGE / #SEEN
const b = MINI_BANK[0];
const L = layoutOf(b.rows);
const start = () => initialState(L.solution);
const fillAll = (s: PlayState) => L.solution.reduce((acc, x, i) => (x ? reducer(acc, { type: "input", cell: i, letter: x, at: 1000 + i }) : acc), s);

describe("mini reducer", () => {
  it("types, erases and completes", () => {
    let s = reducer(start(), { type: "input", cell: 0, letter: "a", at: 500 });
    expect(s.values[0]).toBe("A");
    expect(s.order[0]).toBe(1);
    expect(s.placedAt[0]).toBe(500);
    s = reducer(s, { type: "erase", cell: 0 });
    expect(s.values[0]).toBe("");
    // Black squares and junk keys are ignored.
    expect(reducer(s, { type: "input", cell: 4, letter: "A", at: 0 })).toBe(s);
    expect(reducer(s, { type: "input", cell: 0, letter: "1", at: 0 })).toBe(s);
    const done = fillAll(start());
    expect(isFull(done) && isComplete(done) && isClean(done)).toBe(true);
    expect(solveOrderMap(done)).toMatch(/^[0-4]{25}$/);
    expect(solveOrderMap(done)[4]).toBe("0");
  });

  it("check flags wrong letters, counts as help, and clears when fixed", () => {
    let s = reducer(start(), { type: "input", cell: 0, letter: "Z", at: 0 });
    s = reducer(s, { type: "input", cell: 1, letter: "F", at: 0 });
    s = reducer(s, { type: "check", cells: L.solution.map((_, i) => i) });
    expect(s.wrong[0]).toBe(true);
    expect(s.wrong[1]).toBe(false);
    expect(s.checks).toBe(1);
    expect(s.hints).toBe(1);
    expect(s.mistakes).toBe(1);
    // Checking again doesn't count the same wrong letter twice.
    s = reducer(s, { type: "check", cells: [0] });
    expect(s.mistakes).toBe(1);
    s = reducer(s, { type: "input", cell: 0, letter: "A", at: 0 });
    expect(s.wrong[0]).toBe(false);
    expect(isClean(s)).toBe(false);
  });

  it("reveal locks cells; coach reveals don't double count", () => {
    const word = L.entries[0].cells;
    let s = reducer(start(), { type: "reveal", cells: word, at: 100 });
    expect(word.map((i) => s.values[i]).join("")).toBe("AFAR");
    expect(s.reveals).toBe(1);
    expect(s.hints).toBe(1);
    expect(reducer(s, { type: "input", cell: word[0], letter: "Q", at: 0 })).toBe(s);
    expect(reducer(s, { type: "erase", cell: word[0] })).toBe(s);
    // Revealing an already-right word is a no-op.
    expect(reducer(s, { type: "reveal", cells: word, at: 0 })).toBe(s);
    s = reducer(s, { type: "hint-used" });
    s = reducer(s, { type: "reveal", cells: [L.entries[1].cells[0]], at: 0, coach: true });
    expect(s.hints).toBe(2);
    expect(s.coachHints).toBe(1);
    expect(solveOrderMap(s)[0]).toBe("5");
  });
});

describe("mini cursor", () => {
  const empty = L.solution.map(() => "");

  it("auto-advances through a word, then to the next clue with a gap", () => {
    const v = empty.slice();
    v[0] = "A";
    expect(afterType(L, v, { cell: 0, dir: 0 })).toEqual({ cell: 1, dir: 0 });
    // Skips filled cells within the word.
    v[1] = "F";
    v[2] = "A";
    expect(afterType(L, v, { cell: 1, dir: 0 })).toEqual({ cell: 3, dir: 0 });
    // Word full: on to 5-Across.
    v[3] = "R";
    expect(afterType(L, v, { cell: 3, dir: 0 })).toEqual({ cell: 5, dir: 0 });
    // Overwriting inside a full word just moves along it.
    expect(afterType(L, v, { cell: 1, dir: 0 })).toEqual({ cell: 2, dir: 0 });
  });

  it("backspace stays on a letter, else steps back", () => {
    const v = empty.slice();
    v[0] = "A";
    expect(backTarget(L, v, { cell: 0, dir: 0 })).toEqual({ cell: 0, dir: 0 });
    expect(backTarget(L, v, { cell: 1, dir: 0 })).toEqual({ cell: 0, dir: 0 });
  });

  it("arrows turn first, then move and skip black squares", () => {
    expect(arrow(L, { cell: 0, dir: 0 }, 1, 0)).toEqual({ cell: 0, dir: 1 });
    expect(arrow(L, { cell: 0, dir: 1 }, 1, 0)).toEqual({ cell: 5, dir: 1 });
    expect(arrow(L, { cell: 3, dir: 0 }, 0, 1)).toEqual({ cell: 3, dir: 0 }); // black square at the edge
    expect(arrow(L, { cell: 0, dir: 0 }, -1, 0)).toEqual({ cell: 0, dir: 1 });
  });

  it("steps between clues and knows the entry under the cursor", () => {
    expect(L.entries[entryAt(L, { cell: 0, dir: 1 })].id).toBe("1D");
    expect(stepEntry(L, empty, { cell: 0, dir: 0 }, 1)).toEqual({ cell: 5, dir: 0 });
    expect(stepEntry(L, empty, { cell: 0, dir: 0 }, -1)).toEqual(entryStart(L, empty, L.entries.length - 1));
  });
});
