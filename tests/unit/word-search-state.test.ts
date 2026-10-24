import { describe, expect, it } from "vitest";
import { generateWordSearch, THEMES, wordCells } from "@/lib/games/wordsearch";
import { dragCells, found, foundCount, initialState, isComplete, reducer, solveSkills } from "@/components/wordsearch/state";

const p = generateWordSearch("test:ws-state", THEMES[2], 12);
const cellsOf = (i: number) => wordCells(p.size, p.words[i]);

describe("word search play state", () => {
  it("finds a word dragged either way and records when", () => {
    let s = reducer(initialState(p), { type: "select", cells: cellsOf(0), at: 4200, puzzle: p });
    expect(found(s)[0]).toBe(true);
    expect(s.foundAt[0]).toBe(4200);
    s = reducer(s, { type: "select", cells: cellsOf(1).slice().reverse(), at: 9000, puzzle: p });
    expect(s.order).toEqual([0, 1]);
    // Finding it again changes nothing.
    expect(reducer(s, { type: "select", cells: cellsOf(0), at: 12000, puzzle: p })).toBe(s);
  });

  it("counts a miss without penalty and ignores single squares", () => {
    const s0 = initialState(p);
    const miss = reducer(s0, { type: "select", cells: cellsOf(0).slice(0, 2), at: 1, puzzle: p });
    expect(miss.misses).toBe(1);
    expect(foundCount(miss)).toBe(0);
    expect(reducer(s0, { type: "select", cells: [3], at: 1, puzzle: p })).toBe(s0);
  });

  it("marks coach finds and completes when every word is found", () => {
    let s = reducer(initialState(p), { type: "hint-used" });
    s = reducer(s, { type: "coach-find", word: 2, at: 500 });
    expect(s.coached[2]).toBe(true);
    for (let i = 0; i < p.words.length; i++) s = reducer(s, { type: "select", cells: cellsOf(i), at: 1000 + i, puzzle: p });
    expect(isComplete(s)).toBe(true);
    expect(s.hints).toBe(1);
    const skills = solveSkills(p, s, 100_000);
    expect(skills).toContain("quick");
    expect(skills).not.toContain("unaided");
  });

  it("drags snap to a straight line", () => {
    expect(dragCells(12, 0, 26)).toEqual([0, 13, 26]);
    expect(dragCells(12, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(dragCells(12, 0, 36)).toEqual([0, 12, 24, 36]);
  });
});
