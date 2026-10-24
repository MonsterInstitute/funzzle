import { describe, expect, it } from "vitest";
import { BANK, entriesOf } from "@/lib/games/crossword";
import { helpCount, initialState, isComplete, isFull, makeReducer, MARK, shareMap, solveSkills } from "@/components/crossword/state";

const p = BANK[0];
const reducer = makeReducer(p.grid);
const white = [...p.grid].map((ch, i) => (ch === "#" ? -1 : i)).filter((i) => i >= 0);
const a = white[0];
const wrongLetter = p.grid[a] === "z" ? "q" : "z";

describe("crossword play state", () => {
  it("writes ink and pencil letters, ignores black squares", () => {
    let s = reducer(initialState(p.grid), { type: "input", cell: a, letter: "Q", pencil: false, at: 10 });
    expect(s.values[a]).toBe("q");
    s = reducer(s, { type: "input", cell: a, letter: "r", pencil: true, at: 10 });
    expect(s.pencil[a]).toBe(true);
    expect(s.usedPencil).toBe(true);
    const black = p.grid.indexOf("#");
    expect(reducer(s, { type: "input", cell: black, letter: "a", pencil: false, at: 1 })).toBe(s);
  });

  it("check marks wrong letters and locks right ones; each check counts as help", () => {
    let s = reducer(initialState(p.grid), { type: "input", cell: a, letter: wrongLetter, pencil: false, at: 1 });
    s = reducer(s, { type: "input", cell: white[1], letter: p.grid[white[1]], pencil: false, at: 1 });
    s = reducer(s, { type: "check", cells: [a, white[1]] });
    expect(s.marks[a]).toBe(MARK.wrong);
    expect(s.marks[white[1]]).toBe(MARK.right);
    expect(s.wrong).toBe(1);
    expect(helpCount(s)).toBe(1);
    // A checked-right square can't be changed; a wrong one can.
    expect(reducer(s, { type: "erase", cell: white[1] })).toBe(s);
    s = reducer(s, { type: "input", cell: a, letter: p.grid[a], pencil: false, at: 2 });
    expect(s.marks[a]).toBe(MARK.none);
  });

  it("reveal fills and locks, and stamps completed answers", () => {
    const e = entriesOf(p.grid)[0];
    let s = reducer(initialState(p.grid), { type: "reveal", cells: e.cells, at: 3000 });
    expect(e.cells.every((i) => s.values[i] === p.grid[i] && s.marks[i] === MARK.revealed)).toBe(true);
    expect(s.doneAt[e.id]).toBe(3000);
    expect(s.assists).toBe(1);
    s = reducer(s, { type: "coach-reveal", cell: white.at(-1)!, at: 4000 });
    expect(s.assists).toBe(1);
    expect(s.marks[white.at(-1)!]).toBe(MARK.revealed);
  });

  it("is complete only when every letter is right", () => {
    let s = initialState(p.grid);
    for (const i of white) s = reducer(s, { type: "input", cell: i, letter: i === a ? wrongLetter : p.grid[i], pencil: false, at: 1 });
    expect(isFull(p.grid, s)).toBe(true);
    expect(isComplete(p.grid, s)).toBe(false);
    s = reducer(s, { type: "input", cell: a, letter: p.grid[a], pencil: false, at: 2 });
    expect(isComplete(p.grid, s)).toBe(true);
    expect(Object.keys(s.doneAt).length).toBe(entriesOf(p.grid).length);
    expect(shareMap(p.grid, s)).toMatch(/^[01]+$/);
    expect(solveSkills(p.grid, 11, s, 5 * 60_000)).toEqual(expect.arrayContaining(["grid-11", "clean", "quick"]));
  });
});
