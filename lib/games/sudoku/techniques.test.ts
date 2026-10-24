import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { ALL_DIGITS, bit, candidates, countSolutions, solve, type Grid } from "./grid";
import { applyStep, findStep, nextStep, solveLogically, type Step } from "./techniques";
import { DIFFICULTIES, generateSudoku } from "./generate";

const empty = (): Grid => new Array(81).fill(0);
const fullNotes = () => new Array<number>(81).fill(ALL_DIGITS);
const at = (r: number, c: number) => r * 9 + c;
const box = (b: number) => {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  return Array.from({ length: 9 }, (_, k) => at(r0 + Math.floor(k / 3), c0 + (k % 3)));
};
const row = (r: number) => Array.from({ length: 9 }, (_, c) => at(r, c));
const col = (c: number) => Array.from({ length: 9 }, (_, r) => at(r, c));
const strip = (notes: number[], cells: number[], d: number) => cells.forEach((i) => (notes[i] &= ~bit(d)));
const mask = (...ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
const elimSet = (s: Step) => s.eliminations.map((e) => `${e.cell}:${e.digit}`).sort();
const expected = (cells: number[], digits: number[]) =>
  cells.flatMap((c) => digits.map((d) => `${c}:${d}`)).sort();

/*
 * Hand-made positions: an empty grid plus pencil notes shaped so that exactly
 * one pattern exists and no easier technique applies first.
 */
describe("technique detection", () => {
  it("naked single", () => {
    const g = empty();
    for (let c = 0; c < 8; c++) g[c] = c + 1;
    const s = nextStep(g)!;
    expect(s.technique).toBe("naked-single");
    expect(s.placement).toEqual({ cell: 8, digit: 9 });
  });

  it("hidden single in a box", () => {
    const g = empty();
    g[at(1, 4)] = 1;
    g[at(2, 7)] = 1;
    g[at(5, 1)] = 1;
    g[at(8, 2)] = 1;
    const s = nextStep(g)!;
    expect(s.technique).toBe("hidden-single");
    expect(s.placement).toEqual({ cell: 0, digit: 1 });
    expect(s.units).toEqual([{ kind: "box", index: 0 }]);
  });

  it("pointing", () => {
    const n = fullNotes();
    strip(n, box(0).filter((i) => i >= 9), 5);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("pointing");
    expect(elimSet(s)).toEqual(expected([3, 4, 5, 6, 7, 8], [5]));
  });

  it("claiming", () => {
    const n = fullNotes();
    strip(n, [3, 4, 5, 6, 7, 8], 5);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("claiming");
    expect(elimSet(s)).toEqual(expected([9, 10, 11, 18, 19, 20], [5]));
  });

  it("naked pair", () => {
    const n = fullNotes();
    n[0] = mask(1, 2);
    n[1] = mask(1, 2);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("naked-pair");
    expect(s.focusCells).toEqual([0, 1]);
    expect(elimSet(s)).toEqual(expected([2, 9, 10, 11, 18, 19, 20], [1, 2]));
  });

  it("hidden pair", () => {
    const n = fullNotes();
    const others = box(0).filter((i) => i !== 0 && i !== 10);
    strip(n, others, 1);
    strip(n, others, 2);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("hidden-pair");
    expect(s.focusCells).toEqual([0, 10]);
    expect(elimSet(s)).toEqual(expected([0, 10], [3, 4, 5, 6, 7, 8, 9]));
  });

  it("naked triple", () => {
    const n = fullNotes();
    n[0] = mask(1, 2);
    n[1] = mask(2, 3);
    n[2] = mask(1, 3);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("naked-triple");
    expect(s.focusCells).toEqual([0, 1, 2]);
    expect(elimSet(s)).toEqual(expected([9, 10, 11, 18, 19, 20], [1, 2, 3]));
  });

  it("hidden triple", () => {
    const n = fullNotes();
    const others = box(0).filter((i) => ![0, 10, 20].includes(i));
    for (const d of [1, 2, 3]) strip(n, others, d);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("hidden-triple");
    expect(s.focusCells).toEqual([0, 10, 20]);
    expect(elimSet(s)).toEqual(expected([0, 10, 20], [4, 5, 6, 7, 8, 9]));
  });

  it("x-wing", () => {
    const n = fullNotes();
    for (const r of [0, 3]) strip(n, row(r).filter((i) => i % 9 !== 1 && i % 9 !== 6), 5);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("x-wing");
    expect(s.focusCells).toEqual([at(0, 1), at(0, 6), at(3, 1), at(3, 6)]);
    const targets = [...col(1), ...col(6)].filter((i) => ![0, 3].includes(Math.floor(i / 9)));
    expect(elimSet(s)).toEqual(expected(targets, [5]));
  });

  it("x-wing on the well-known example", () => {
    // Classic X-Wing teaching puzzle (SudokuWiki): after the basics, 7 forms an X-Wing.
    const g = [..."100000569492056108056109240009640801064010000218035604040500016905061402621000005"].map(Number);
    expect(countSolutions(g)).toBe(1);
    const r = solveLogically(g);
    expect(r.solved).toBe(true);
    expect(r.grid).toEqual(solve(g));
    expect(r.steps.some((s) => s.technique === "x-wing")).toBe(true);
  });

  it("swordfish", () => {
    const n = fullNotes();
    const keep: Record<number, number[]> = { 0: [1, 4], 3: [4, 7], 6: [1, 7] };
    for (const r of [0, 3, 6]) strip(n, row(r).filter((i) => !keep[r].includes(i % 9)), 5);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("swordfish");
    const targets = [...col(1), ...col(4), ...col(7)].filter((i) => ![0, 3, 6].includes(Math.floor(i / 9)));
    expect(elimSet(s)).toEqual(expected(targets, [5]));
  });

  it("xy-wing", () => {
    const n = fullNotes();
    n[at(0, 0)] = mask(1, 2);
    n[at(0, 4)] = mask(1, 3);
    n[at(2, 0)] = mask(2, 3);
    const s = nextStep(empty(), n)!;
    expect(s.technique).toBe("xy-wing");
    expect(s.focusCells).toEqual([at(0, 0), at(0, 4), at(2, 0)]);
    expect(elimSet(s)).toEqual(expected([at(0, 1), at(0, 2), at(2, 3), at(2, 4), at(2, 5)], [3]));
  });

  it("returns null when stuck or contradictory", () => {
    expect(nextStep(empty())).toBeNull();
    const n = fullNotes();
    n[5] = 0;
    expect(nextStep(empty(), n)).toBeNull();
  });
});

/** Checks a step against the known solution: placements right, eliminations never remove the true digit. */
function assertSound(step: Step, solution: Grid) {
  if (step.placement) expect(step.placement.digit).toBe(solution[step.placement.cell]);
  else expect(step.eliminations.length).toBeGreaterThan(0);
  for (const e of step.eliminations) expect(e.digit).not.toBe(solution[e.cell]);
}

describe("soundness against brute force", () => {
  it("every solver step on generated puzzles is correct", () => {
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 8; s++) {
        const p = generateSudoku(`sound:${s}`, d);
        const r = solveLogically(p.puzzle);
        expect(r.solved).toBe(true);
        expect(r.grid).toEqual(p.solution);
        r.steps.forEach((step) => assertSound(step, p.solution));
      }
    }
  });

  it("nextStep is correct on many random partial states", () => {
    const rng = createRng("partial-states");
    let checked = 0;
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 6; s++) {
        const p = generateSudoku(`partial:${s}`, d);
        for (let k = 0; k < 25; k++) {
          // Fill a random fraction of the blanks with correct digits.
          const g = p.puzzle.slice();
          const share = rng.next();
          for (let i = 0; i < 81; i++) if (!g[i] && rng.next() < share) g[i] = p.solution[i];
          const step = nextStep(g);
          if (g.includes(0)) {
            expect(step).not.toBeNull();
            assertSound(step!, p.solution);
            checked++;
          }
          // Also walk a few steps on solver-maintained notes.
          const cand = candidates(g);
          const work = g.slice();
          for (let n = 0; n < 10; n++) {
            const next = findStep(work, cand);
            if (!next) break;
            assertSound(next, p.solution);
            applyStep(work, cand, next);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("prefers singles whenever one exists", () => {
    const p = generateSudoku("singles-first", "expert");
    const r = solveLogically(p.puzzle);
    const g = p.puzzle.slice();
    const cand = candidates(g);
    for (const step of r.steps) {
      if (step.placement === undefined) {
        // No single may exist at this point in the solver's own state.
        expect(findStep(g, cand, 1)).toBeNull();
      }
      applyStep(g, cand, step);
    }
  });
});
