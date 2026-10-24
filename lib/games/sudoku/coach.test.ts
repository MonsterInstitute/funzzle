import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { DIFFICULTIES, generateSudoku } from "./generate";
import { hintLadder } from "./coach";

const nonEmpty = (s: string) => expect(s.trim().length).toBeGreaterThan(0);

describe("hintLadder", () => {
  it("flags a wrong digit before anything else", () => {
    const p = generateSudoku("coach:mistake", "medium");
    const g = p.puzzle.slice();
    const cell = g.indexOf(0);
    g[cell] = (p.solution[cell] % 9) + 1;
    const h = hintLadder(g, p.solution)!;
    expect(h.title).toBe("Mistake");
    expect(h.mistakeCell).toBe(cell);
    const r = Math.floor(cell / 9) + 1;
    const c = (cell % 9) + 1;
    expect(h.direction).toBe(`One of your numbers doesn't fit the solution. Check row ${r}.`);
    expect(h.specific).toBe(`The number in row ${r}, column ${c} is wrong.`);
    expect(h.answer).toBe(`Clear it: R${r}C${c} should be ${p.solution[cell]}.`);
    expect(h.answerPlacement).toEqual({ cell, digit: p.solution[cell] });
  });

  it("returns null for a solved grid", () => {
    const p = generateSudoku("coach:solved", "easy");
    expect(hintLadder(p.solution, p.solution)).toBeNull();
  });

  it("explains a naked single in plain words", () => {
    // Row 1 is full except its last cell.
    const solution = generateSudoku("coach:single", "easy").solution;
    const g = solution.slice();
    g[8] = 0;
    for (let i = 9; i < 81; i++) g[i] = 0;
    const h = hintLadder(g, solution)!;
    expect(h.technique).toBe("naked-single");
    expect(h.direction).toBe("Look at row 1. One cell there can only take one number.");
    expect(h.answer).toBe(`It's a ${solution[8]}.`);
    expect(h.answerPlacement).toEqual({ cell: 8, digit: solution[8] });
  });

  it("coaches every puzzle to the end with correct, concrete answers", () => {
    const seen = new Set<string>();
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 5; s++) {
        const p = generateSudoku(`coach:${s}`, d);
        const g = p.puzzle.slice();
        for (let n = 0; n < 81 && g.includes(0); n++) {
          const h = hintLadder(g, p.solution)!;
          expect(h).not.toBeNull();
          expect(h.mistakeCell).toBeUndefined();
          expect(h.title).not.toBe("Tough spot");
          [h.title, h.direction, h.specific, h.answer].forEach(nonEmpty);
          expect(h.answerPlacement).toBeDefined();
          const { cell, digit } = h.answerPlacement!;
          expect(g[cell]).toBe(0);
          expect(digit).toBe(p.solution[cell]);
          seen.add(h.technique);
          g[cell] = digit;
        }
        expect(g).toEqual(p.solution);
      }
    }
    expect(seen.has("naked-single")).toBe(true);
    expect(seen.has("hidden-single")).toBe(true);
  });

  it("gives correct ladders from random partial states", () => {
    const rng = createRng("coach-partial");
    for (let s = 0; s < 20; s++) {
      const p = generateSudoku(`coach-partial:${s}`, DIFFICULTIES[s % 4]);
      const g = p.puzzle.slice();
      for (let i = 0; i < 81; i++) if (!g[i] && rng.next() < 0.3) g[i] = p.solution[i];
      if (!g.includes(0)) continue;
      const h = hintLadder(g, p.solution)!;
      expect(h.answerPlacement).toBeDefined();
      expect(h.answerPlacement!.digit).toBe(p.solution[h.answerPlacement!.cell]);
    }
  });
});
