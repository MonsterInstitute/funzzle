import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { EMPTY, FILLED, UNKNOWN, analyzeLine, clueOf, lineStep } from "./line";
import { applyStep, cluesOf, lineSolvable, solveLogically } from "./solver";
import { PICTURES } from "./pictures";
import { SIZES, generateNonogram, skillsOf } from "./generate";
import { hintLadder } from "./coach";

/** Every full line consistent with the known cells and the clue. */
function brute(clue: number[], line: number[]): number[][] {
  const out: number[][] = [];
  const n = line.length;
  for (let m = 0; m < 1 << n; m++) {
    const cells = Array.from({ length: n }, (_, i) => ((m >> i) & 1 ? FILLED : EMPTY));
    if (cells.some((v, i) => line[i] !== UNKNOWN && line[i] !== v)) continue;
    if (clueOf(cells).join() === clue.join()) out.push(cells);
  }
  return out;
}

function randomLine(seed: string) {
  const rng = createRng(seed);
  const n = 1 + rng.int(10);
  const truth = Array.from({ length: n }, () => (rng.next() < 0.55 ? FILLED : EMPTY));
  const clue = clueOf(truth);
  const line = truth.map((v) => (rng.next() < 0.35 ? v : UNKNOWN));
  return { truth, clue, line, rng };
}

describe("line solver", () => {
  it("reads clues", () => {
    expect(clueOf([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3]);
    expect(clueOf([0, 0, 0])).toEqual([]);
  });

  it("matches brute force on random lines", () => {
    for (let s = 0; s < 400; s++) {
      const { clue, line } = randomLine(`line:${s}`);
      const all = brute(clue, line);
      const a = analyzeLine(clue, line)!;
      expect(a).not.toBeNull();
      for (let c = 0; c < line.length; c++) {
        expect(a.canFill[c]).toBe(all.some((x) => x[c] === FILLED));
        expect(a.canEmpty[c]).toBe(all.some((x) => x[c] === EMPTY));
      }
    }
  });

  it("spots contradictions", () => {
    expect(analyzeLine([3], [UNKNOWN, EMPTY, UNKNOWN, UNKNOWN])).toBeNull();
    expect(analyzeLine([1], [FILLED, UNKNOWN, FILLED])).toBeNull();
  });

  it("finds the classic simple-boxes overlap", () => {
    const step = lineStep([8], new Array(10).fill(UNKNOWN))!;
    expect(step.technique).toBe("simple-boxes");
    expect(step.deduction.fill).toEqual([2, 3, 4, 5, 6, 7]);
    expect(lineStep([], new Array(4).fill(UNKNOWN))).toEqual({ technique: "simple-spaces", deduction: { fill: [], empty: [0, 1, 2, 3] } });
  });

  it("every technique is sound", () => {
    for (let s = 0; s < 400; s++) {
      const { truth, clue, line } = randomLine(`sound:${s}`);
      for (const t of ["simple-boxes", "simple-spaces", "edge-logic", "forcing"] as const) {
        const step = lineStep(clue, line, t);
        if (!step) continue;
        for (const c of step.deduction.fill) expect(truth[c]).toBe(FILLED);
        for (const c of step.deduction.empty) expect(truth[c]).toBe(EMPTY);
      }
    }
  });
});

describe("pictures", () => {
  for (const size of SIZES) {
    it(`every ${size}×${size} picture is square and solvable by line logic`, () => {
      for (const p of PICTURES[size]) {
        expect(p.rows).toHaveLength(size);
        for (const row of p.rows) expect(row).toMatch(new RegExp(`^[#.]{${size}}$`));
        const sol = p.rows.join("").split("").map((ch) => (ch === "#" ? 1 : 0));
        expect(lineSolvable(cluesOf(sol, size), size), p.name).toBe(true);
      }
    });
  }
});

describe("generateNonogram", () => {
  it("is deterministic per seed and size", () => {
    expect(generateNonogram("nonogram:2026-10-24", 10)).toEqual(generateNonogram("nonogram:2026-10-24", 10));
    const days = new Set(Array.from({ length: 8 }, (_, d) => generateNonogram(`nonogram:2026-10-${10 + d}`, 10).solution.join("")));
    expect(days.size).toBeGreaterThan(5);
  });

  for (const size of SIZES) {
    it(`builds unique, line-solvable ${size}×${size} puzzles`, () => {
      const times: number[] = [];
      let pictures = 0;
      for (let s = 0; s < 40; s++) {
        const t0 = performance.now();
        const p = generateNonogram(`test:${s}`, size);
        times.push(performance.now() - t0);
        if (p.name) pictures++;
        expect(p.solution).toHaveLength(size * size);
        expect(p.clues).toEqual(cluesOf(p.solution, size));
        // Line logic alone finishes it, so the picture is the only solution.
        const r = solveLogically(p.clues, size);
        expect(r.solved).toBe(true);
        expect(r.grid.map((v) => (v === FILLED ? 1 : 0))).toEqual(p.solution);
        expect(r.steps.some((st) => st.technique === "contradiction")).toBe(false);
        expect(r.hardest).toBe(p.hardest);
        const filled = p.solution.filter(Boolean).length / p.solution.length;
        expect(filled).toBeGreaterThan(0.3);
        expect(skillsOf(p).length).toBeGreaterThan(0);
      }
      expect(pictures).toBeGreaterThan(0);
      expect(pictures).toBeLessThan(40);
      times.sort((a, b) => a - b);
      const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(1);
      console.log(`[nonogram timing] ${size}×${size}: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`);
    }, 60_000);
  }
});

describe("hintLadder", () => {
  it("flags a wrong mark before anything else", () => {
    const p = generateNonogram("coach:mistake", 10);
    const cells = new Array(100).fill(UNKNOWN);
    const wrong = p.solution.findIndex((v) => !v);
    cells[wrong] = FILLED;
    const h = hintLadder(cells, p.solution, p.clues, 10)!;
    expect(h.title).toBe("Mistake");
    expect(h.mistakeCells).toEqual([wrong]);
    expect(h.empty).toEqual([wrong]);
    expect(h.specific).toBe(`The cell in row ${Math.floor(wrong / 10) + 1}, column ${(wrong % 10) + 1} should be empty.`);
  });

  it("returns null once every filled cell is in place", () => {
    const p = generateNonogram("coach:solved", 5);
    expect(hintLadder(p.solution.map((v) => (v ? FILLED : UNKNOWN)), p.solution, p.clues, 5)).toBeNull();
  });

  it("names the line and the rule on a fresh puzzle", () => {
    const p = generateNonogram("coach:fresh", 10);
    const h = hintLadder(new Array(100).fill(UNKNOWN), p.solution, p.clues, 10)!;
    expect(h.technique).toBe("simple-boxes");
    expect(h.direction).toMatch(/^Look at (row|column) \d+, with the clue [\d ]+\.$/);
    expect(h.specific).toMatch(/^Simple boxes:/);
    expect(h.answer).toMatch(/^In (row|column) \d+, fill cells? /);
  });

  it("coaches every puzzle to the end with correct answers", () => {
    const seen = new Set<string>();
    for (const size of SIZES) {
      for (let s = 0; s < 6; s++) {
        const p = generateNonogram(`coach:${s}`, size);
        const cells = new Array(size * size).fill(UNKNOWN);
        for (let n = 0; n < 400; n++) {
          const h = hintLadder(cells, p.solution, p.clues, size);
          if (!h) break;
          seen.add(h.technique);
          expect(h.title).not.toBe("Mistake");
          for (const s of [h.direction, h.specific, h.answer]) expect(s.trim().length).toBeGreaterThan(0);
          expect(h.fill.length + h.empty.length).toBeGreaterThan(0);
          for (const i of h.fill) expect(p.solution[i]).toBe(1);
          for (const i of h.empty) expect(p.solution[i]).toBe(0);
          applyStep(cells, { technique: h.technique, line: h.line!, fill: h.fill, empty: h.empty });
        }
        expect(cells.map((v) => (v === FILLED ? 1 : 0))).toEqual(p.solution);
      }
    }
    expect(seen.has("simple-boxes")).toBe(true);
    expect(seen.has("edge-logic")).toBe(true);
  });
});
