import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { containsBlockedSubstring } from "@/lib/games/words/blocklist";
import { CELLS, gridLines, spanSides, tracePaths } from "./grid";
import { generateWordHunt, partitionable, shapeProblems, TilingError } from "./generate";
import { tilingProblems } from "./test-helpers";

const THEME = { span: "breakfast", words: ["oatmeal", "granola", "cereal", "omelet", "pancake", "waffle"] };

/** Random letters of the given lengths (geometry stress test; no dictionary). */
function synthetic(seed: string) {
  const rng = createRng(seed);
  for (;;) {
    const span = 6 + rng.int(7);
    const n = 5 + rng.int(4);
    const lengths: number[] = [];
    let left = CELLS - span;
    for (let i = 0; i < n; i++) {
      const rest = n - i - 1;
      const lo = Math.max(4, left - rest * 12);
      const hi = Math.min(12, left - rest * 4);
      if (lo > hi) break;
      const len = i === n - 1 ? left : lo + rng.int(hi - lo + 1);
      lengths.push(len);
      left -= len;
    }
    if (left !== 0 || lengths.length !== n || lengths.some((l) => l < 4 || l > 12)) continue;
    const word = (len: number, k: number) => Array.from({ length: len }, (_, j) => "abcdefghiklmnoprstuvwy"[(k * 7 + j * 3 + rng.int(22)) % 22]).join("");
    return { span: word(span, 0), words: lengths.map((l, k) => word(l, k + 1)) };
  }
}

describe("generateWordHunt", () => {
  it("is deterministic per seed", () => {
    const a = generateWordHunt(THEME, "word-hunt:2026-10-24");
    expect(generateWordHunt(THEME, "word-hunt:2026-10-24")).toEqual(a);
    expect(generateWordHunt(THEME, "word-hunt:2026-10-25").grid).not.toBe(a.grid);
  });

  it("tiles the board with non-crossing paths and a span word edge to edge", () => {
    const g = generateWordHunt(THEME, "test");
    expect(tilingProblems(g.grid, g.words)).toEqual([]);
    expect(g.words[0]).toMatchObject({ word: "BREAKFAST", span: true });
    expect(g.words.slice(1).map((w) => w.word)).toEqual(THEME.words.map((w) => w.toUpperCase()));
    expect(gridLines(g.grid).some(containsBlockedSubstring)).toBe(false);
    for (const w of g.words) expect(tracePaths(g.grid, w.word, 1000).length).toBeGreaterThanOrEqual(1);
  });

  it("lays out any mix of lengths quickly", () => {
    const times: number[] = [];
    let topBottom = 0;
    for (let s = 0; s < 120; s++) {
      const theme = synthetic(`mix:${s}`);
      expect(shapeProblems(theme)).toEqual([]);
      const t0 = performance.now();
      const g = generateWordHunt(theme, `seed:${s}`);
      times.push(performance.now() - t0);
      expect(tilingProblems(g.grid, g.words)).toEqual([]);
      if (spanSides(g.words[0].path).topBottom) topBottom++;
    }
    // Long span words sometimes run top to bottom, not only left to right.
    expect(topBottom).toBeGreaterThan(0);
    times.sort((a, b) => a - b);
    const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(1);
    console.log(`[word-hunt timing] generate: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`);
    expect(Number(pct(0.95))).toBeLessThan(250);
  }, 60_000);

  it("rejects themes that can't fill the board", () => {
    expect(shapeProblems({ span: "breakfast", words: ["toast", "jam", "eggs", "tea", "milk"] }).join()).toMatch(/4–12 letters|exactly 48/);
    expect(shapeProblems({ span: "eggs", words: THEME.words }).join()).toMatch(/span word/);
    expect(shapeProblems({ span: "breakfast", words: ["oatmeal", "oatmeal", "cereal", "omelet", "pancake", "waffle"] }).join()).toMatch(/distinct/);
    expect(shapeProblems({ span: "breakfast", words: ["ice cream", "granola", "cereal", "omelet", "pancake", "waffle"] }).join()).toMatch(/letters only/);
    expect(() => generateWordHunt({ span: "breakfast", words: ["toast"] }, "x")).toThrow(TilingError);
  });
});

describe("partitionable", () => {
  it("shares word lengths out among regions exactly", () => {
    expect(partitionable([10, 8], [6, 4, 8])).toBe(true);
    expect(partitionable([9, 9], [6, 4, 8])).toBe(false);
    expect(partitionable([3, 15], [6, 4, 8])).toBe(false);
    expect(partitionable([18], [6, 4, 8])).toBe(true);
  });
});
