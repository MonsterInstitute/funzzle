import { describe, expect, it } from "vitest";
import { conflicts, countSolutions } from "./grid";
import { solveLogically } from "./techniques";
import { DIFFICULTIES, GIVENS_RANGE, generateSudoku, gradeOf } from "./generate";

describe("generateSudoku", () => {
  it("is deterministic per seed and difficulty", () => {
    for (const d of DIFFICULTIES) {
      expect(generateSudoku("sudoku:2026-10-24", d)).toEqual(generateSudoku("sudoku:2026-10-24", d));
    }
    const a = generateSudoku("sudoku:2026-10-24", "medium");
    const b = generateSudoku("sudoku:2026-10-25", "medium");
    expect(a.puzzle).not.toEqual(b.puzzle);
    // Difficulties of the same day must not share a solution (an easier one would leak the answer).
    expect(generateSudoku("sudoku:2026-10-24", "easy").solution).not.toEqual(a.solution);
  });

  for (const d of DIFFICULTIES) {
    it(`builds valid, unique, logically solvable ${d} puzzles`, () => {
      const [lo, hi] = GIVENS_RANGE[d];
      const times: number[] = [];
      for (let s = 0; s < 30; s++) {
        const t0 = performance.now();
        const p = generateSudoku(`test:${s}`, d);
        times.push(performance.now() - t0);
        expect(p.difficulty).toBe(d);
        expect(p.solution.every((x) => x >= 1 && x <= 9)).toBe(true);
        expect(conflicts(p.solution)).toEqual([]);
        p.puzzle.forEach((x, i) => expect(x === 0 || x === p.solution[i]).toBe(true));
        expect(p.givens).toBe(p.puzzle.filter((x) => x).length);
        expect(p.givens).toBeGreaterThanOrEqual(lo);
        expect(p.givens).toBeLessThanOrEqual(hi);
        expect(countSolutions(p.puzzle)).toBe(1);
        const r = solveLogically(p.puzzle);
        expect(r.solved).toBe(true);
        expect(r.grid).toEqual(p.solution);
        expect(gradeOf(r)).toBe(d);
        expect(r.hardest).toBe(p.hardest);
        expect(Math.floor(p.score / 1000)).toBe(DIFFICULTIES.indexOf(d));
      }
      times.sort((a, b) => a - b);
      const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0);
      console.log(`[sudoku timing] ${d}: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`);
    }, 60_000);
  }
});
