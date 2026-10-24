import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { ALL, analyzeRun, bit, buildBoard, combosFor, countSolutions, digitsOf, type Run } from "./grid";
import { TECHNIQUES, solveLogically } from "./techniques";
import { DIFFICULTIES, SIZE_OF, boardOf, generateKakuro } from "./generate";
import { hintLadder } from "./coach";

const digits = (masks: number[]) => masks.map(digitsOf);

describe("sum combinations", () => {
  it("knows the unique sums", () => {
    expect(digits(combosFor(2, 3))).toEqual([[1, 2]]);
    expect(digits(combosFor(2, 4))).toEqual([[1, 3]]);
    expect(digits(combosFor(2, 16))).toEqual([[7, 9]]);
    expect(digits(combosFor(2, 17))).toEqual([[8, 9]]);
    expect(digits(combosFor(3, 6))).toEqual([[1, 2, 3]]);
    expect(digits(combosFor(4, 30))).toEqual([[6, 7, 8, 9]]);
    expect(combosFor(2, 10)).toHaveLength(4);
    expect(combosFor(2, 10).some((m) => m & bit(5))).toBe(false);
    expect(combosFor(2, 19)).toEqual([]);
  });
});

describe("analyzeRun", () => {
  it("matches brute force on random runs", () => {
    for (let s = 0; s < 300; s++) {
      const rng = createRng(`run:${s}`);
      const k = 2 + rng.int(4);
      const truth = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, k);
      const run: Run = { id: 0, dir: "across", clue: 0, cells: truth.map((_, i) => i + 1), sum: truth.reduce((a, b) => a + b, 0) };
      const values = new Array(k + 1).fill(0);
      const cand = new Array(k + 1).fill(0);
      truth.forEach((d, i) => {
        if (rng.next() < 0.25) values[i + 1] = d;
        else cand[i + 1] = (ALL & ~(rng.next() < 0.5 ? 0 : bit(1 + rng.int(9)) | bit(1 + rng.int(9)))) | bit(d);
      });
      const a = analyzeRun(run, values, cand)!;
      expect(a).not.toBeNull();
      // Brute force: every assignment of distinct digits to the empty cells.
      const empty = run.cells.filter((i) => !values[i]);
      const placed = run.cells.filter((i) => values[i]).map((i) => values[i]);
      const want = new Map(empty.map((i) => [i, 0]));
      const rec = (p: number, used: number[], sum: number) => {
        if (p === empty.length) {
          if (sum === run.sum) used.slice(placed.length).forEach((d, j) => want.set(empty[j], want.get(empty[j])! | bit(d)));
          return;
        }
        for (let d = 1; d <= 9; d++) if (!used.includes(d) && cand[empty[p]] & bit(d)) rec(p + 1, [...used, d], sum + d);
      };
      rec(0, placed, placed.reduce((x, y) => x + y, 0));
      for (const i of empty) expect(a.possible.get(i)).toBe(want.get(i));
    }
  });
});

describe("countSolutions", () => {
  it("sees two ways to fill a symmetric 2×2 block", () => {
    // Interior 2×2, all white: across 3/3, down 3/3 → [1 2 / 2 1] or [2 1 / 1 2].
    const white = [false, false, false, false, true, true, false, true, true];
    const across = [0, 0, 0, 3, 0, 0, 3, 0, 0];
    const down = [0, 3, 3, 0, 0, 0, 0, 0, 0];
    const board = buildBoard(2, white, across, down);
    expect(countSolutions(board, new Array(9).fill(0))).toBe(2);
    // 3 / 4 across and 3 / 4 down pins it: [1 2 / 2 ... ] has one answer.
    const b2 = buildBoard(2, white, [0, 0, 0, 3, 0, 0, 4, 0, 0], [0, 4, 3, 0, 0, 0, 0, 0, 0]);
    expect(countSolutions(b2, new Array(9).fill(0))).toBe(1);
  });
});

describe("generateKakuro", () => {
  it("is deterministic per seed and difficulty", () => {
    expect(generateKakuro("kakuro:2026-10-24", "medium")).toEqual(generateKakuro("kakuro:2026-10-24", "medium"));
    expect(generateKakuro("kakuro:2026-10-24", "medium").solution).not.toEqual(generateKakuro("kakuro:2026-10-25", "medium").solution);
  });

  for (const d of DIFFICULTIES) {
    it(`builds valid, unique, logically solvable ${d} puzzles`, () => {
      const times: number[] = [];
      for (let s = 0; s < 20; s++) {
        const t0 = performance.now();
        const p = generateKakuro(`test:${s}`, d);
        times.push(performance.now() - t0);
        expect(p.difficulty).toBe(d);
        expect(p.size).toBe(SIZE_OF[d]);
        const W = p.size + 1;
        expect(p.layout).toHaveLength(W * W);
        const board = boardOf(p);
        // 180° symmetric black cells, clue border all black.
        for (let r = 1; r <= p.size; r++) {
          for (let c = 1; c <= p.size; c++) expect(p.layout[r * W + c]).toBe(p.layout[(W - r) * W + (W - c)]);
        }
        for (let i = 0; i < W; i++) expect(p.layout[i] + p.layout[i * W]).toBe("##");
        // Every white cell sits in an across and a down run of 2+, digits never repeat, clues add up.
        for (let i = 0; i < W * W; i++) {
          if (!board.white[i]) continue;
          expect(p.solution[i]).toBeGreaterThanOrEqual(1);
          expect(p.solution[i]).toBeLessThanOrEqual(9);
          expect(board.runOf[i][0]).toBeGreaterThanOrEqual(0);
          expect(board.runOf[i][1]).toBeGreaterThanOrEqual(0);
        }
        for (const run of board.runs) {
          expect(run.cells.length).toBeGreaterThanOrEqual(2);
          const ds = run.cells.map((i) => p.solution[i]);
          expect(new Set(ds).size).toBe(ds.length);
          expect(ds.reduce((a, b) => a + b, 0)).toBe(run.sum);
        }
        const empty = p.solution.map(() => 0);
        expect(countSolutions(board, empty, 2)).toBe(1);
        const r = solveLogically(board, empty);
        expect(r.solved).toBe(true);
        expect(r.values).toEqual(p.solution);
        expect(r.hardest).toBe(p.hardest);
        if (d === "easy") expect(r.steps.some((st) => st.technique === "crossing-elimination")).toBe(false);
        else expect(r.steps.some((st) => st.technique === "crossing-elimination")).toBe(true);
      }
      times.sort((a, b) => a - b);
      const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0);
      console.log(`[kakuro timing] ${d} (${SIZE_OF[d]}×${SIZE_OF[d]}): p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`);
    }, 120_000);
  }
});

describe("hintLadder", () => {
  it("flags a wrong digit before anything else", () => {
    const p = generateKakuro("coach:mistake", "easy");
    const board = boardOf(p);
    const values = p.solution.map(() => 0);
    const cell = p.layout.indexOf(".");
    values[cell] = (p.solution[cell] % 9) + 1;
    const h = hintLadder(board, values, p.solution)!;
    expect(h.title).toBe("Mistake");
    expect(h.mistakeCell).toBe(cell);
    expect(h.answerPlacement).toEqual({ cell, digit: p.solution[cell] });
  });

  it("returns null for a solved board", () => {
    const p = generateKakuro("coach:solved", "easy");
    expect(hintLadder(boardOf(p), p.solution, p.solution)).toBeNull();
  });

  it("explains a unique sum in plain words", () => {
    // Interior 2×2 with across 3 / 4 and down 4 / 3: every run is a unique sum.
    const white = [false, false, false, false, true, true, false, true, true];
    const board = buildBoard(2, white, [0, 0, 0, 3, 0, 0, 4, 0, 0], [0, 4, 3, 0, 0, 0, 0, 0, 0]);
    const solution = [0, 0, 0, 0, 1, 2, 0, 3, 1];
    const h = hintLadder(board, new Array(9).fill(0), solution)!;
    // Both runs through the cell are unique sums, so the coach calls it an intersection.
    expect(h.title).toBe("Intersection");
    expect(h.direction).toMatch(/where an across run and a down run cross/);
    expect(h.specific).toMatch(/A 3 in two cells can only be 1 \+ 2\./);
    expect(h.specific).toMatch(/A 4 in two cells can only be 1 \+ 3\./);
    expect(h.specific).toMatch(/That leaves only 1 for row 1, column 1\.$/);
    expect(h.answerPlacement).toEqual({ cell: h.focusCells[0], digit: solution[h.focusCells[0]] });
  });

  it("coaches every puzzle to the end with correct, concrete answers", () => {
    const seen = new Set<string>();
    for (const d of DIFFICULTIES) {
      for (let s = 0; s < 4; s++) {
        const p = generateKakuro(`coach:${s}`, d);
        const board = boardOf(p);
        const values = p.solution.map(() => 0);
        for (let n = 0; n < 200; n++) {
          const h = hintLadder(board, values, p.solution);
          if (!h) break;
          seen.add(h.technique);
          expect(h.title).not.toBe("Mistake");
          expect(h.title).not.toBe("Tough spot");
          for (const t of [h.direction, h.specific, h.answer]) expect(t.trim().length).toBeGreaterThan(0);
          const { cell, digit } = h.answerPlacement!;
          expect(values[cell]).toBe(0);
          expect(digit).toBe(p.solution[cell]);
          values[cell] = digit;
        }
        expect(values).toEqual(p.solution);
      }
    }
    for (const t of TECHNIQUES) expect(seen.has(t), t).toBe(true);
  }, 60_000);
});
