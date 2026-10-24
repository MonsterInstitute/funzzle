import { describe, expect, it } from "vitest";
import { createRng } from "../kit/rng";
import { containsBlockedSubstring } from "../words/blocklist";
import { isCommon } from "../words/lexicon";
import { fillPattern, generateGrid, gridWords, isInflection, MINI_AVOID, wordProblems } from "./fill";
import { gridLines, layoutOf, shapeProblems } from "./grid";
import { blackCount, patterns5, patterns7 } from "./patterns";

describe("patterns", () => {
  it("are symmetric, fully checked, connected, entries >= 3", () => {
    const p5 = patterns5();
    expect(p5.length).toBeGreaterThanOrEqual(6);
    for (const p of [...p5, ...patterns7()]) expect(shapeProblems(p)).toEqual([]);
    expect(Math.max(...p5.map(blackCount))).toBeLessThanOrEqual(4);
    expect(p5.some((p) => blackCount(p) === 0)).toBe(true);
  });

  it("rejects bad shapes", () => {
    expect(shapeProblems(["#....", ".....", ".....", ".....", "....."])).toContain("black squares are not symmetric");
    expect(shapeProblems([".#...", ".....", ".....", ".....", "...#."]).join()).toMatch(/shorter than 3|not in both/);
  });
});

describe("layoutOf", () => {
  it("numbers cells and derives entries", () => {
    const L = layoutOf(["##ROW", "PEEVE", "OCCUR", "SHAME", "TOP##"]);
    expect(L.across.map((e) => `${e.id}:${e.answer}`)).toEqual(["1A:ROW", "4A:PEEVE", "6A:OCCUR", "7A:SHAME", "8A:TOP"]);
    expect(L.down.map((e) => `${e.id}:${e.answer}`)).toEqual(["1D:RECAP", "2D:OVUM", "3D:WERE", "4D:POST", "5D:ECHO"]);
    expect(L.numbers[2]).toBe(1);
    // Row 2, column 2: the C of OCCUR (6A) and of RECAP (1D).
    expect(L.cellEntries[12]).toEqual([2, 5]);
  });
});

describe("generateGrid", () => {
  it("is deterministic per seed", () => {
    expect(generateGrid("mini-crossword:2026-10-24").rows).toEqual(generateGrid("mini-crossword:2026-10-24").rows);
    expect(generateGrid("mini-crossword:2026-10-24").rows).not.toEqual(generateGrid("mini-crossword:2026-10-25").rows);
  });

  it("fills valid 5×5 grids from common words", () => {
    const times: number[] = [];
    for (let d = 1; d <= 40; d++) {
      const t0 = performance.now();
      const g = generateGrid(`test-mini:${d}`);
      times.push(performance.now() - t0);
      expect(g.size).toBe(5);
      expect(shapeProblems(g.rows)).toEqual([]);
      expect(wordProblems(g)).toEqual([]);
      const words = gridWords(g.rows);
      expect(new Set(words).size).toBe(words.length);
      for (const w of words) {
        expect(w.length).toBeGreaterThanOrEqual(3);
        expect(isCommon(w)).toBe(true);
        expect(MINI_AVOID.has(w)).toBe(false);
      }
      expect(gridLines(g.rows).some(containsBlockedSubstring)).toBe(false);
      expect(blackCount(g.rows)).toBeLessThanOrEqual(4);
    }
    times.sort((a, b) => a - b);
    const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0);
    console.log(`[mini timing] 5×5 fill: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`);
  }, 60_000);

  it("avoids plain inflections when it can", () => {
    let infl = 0;
    let total = 0;
    for (let d = 1; d <= 15; d++) {
      const words = gridWords(generateGrid(`test-infl:${d}`).rows);
      infl += words.filter(isInflection).length;
      total += words.length;
    }
    expect(infl / total).toBeLessThan(0.05);
  });

  it("respects an exclude list and the node budget", () => {
    const p = patterns5().find((x) => blackCount(x) === 4)!;
    const g = fillPattern(p, createRng("x"), { exclude: ["about", "above"] });
    expect(g).not.toBeNull();
    expect(gridWords(g!.rows)).not.toContain("about");
    expect(fillPattern(patterns5().find((x) => blackCount(x) === 0)!, createRng("y"), { maxNodes: 3 })).toBeNull();
  });

  it("can fill a 7×7 grid", () => {
    const t0 = performance.now();
    const g = generateGrid("test-mini7:1", 7);
    console.log(`[mini timing] 7×7 fill: ${(performance.now() - t0).toFixed(0)} ms, ${g.nodes} nodes`);
    expect(g.size).toBe(7);
    expect(shapeProblems(g.rows)).toEqual([]);
    expect(wordProblems(g)).toEqual([]);
  }, 60_000);
});
