import { describe, expect, it } from "vitest";
import { containsBlockedSubstring } from "@/lib/games/words/blocklist";
import { isWord } from "@/lib/games/words/lexicon";
import { BANK } from "./bank";
import { CELLS, gridLines, isPath, spell, touchesOppositeSides, tracePaths } from "./grid";
import { bankIdForDate, bankPuzzle } from "./server";
import { tilingProblems } from "./test-helpers";
import { themeProblems } from "./validate";

describe("Word Hunt fallback bank", () => {
  it("has at least 30 distinct themes", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BANK.map((t) => t.id)).size).toBe(BANK.length);
    expect(new Set(BANK.map((t) => t.title.toLowerCase())).size).toBe(BANK.length);
  });

  for (const theme of BANK) {
    it(`${theme.id}: valid words, 48 letters, and a grid that tiles`, () => {
      expect(themeProblems(theme)).toEqual([]);
      const t0 = performance.now();
      const p = bankPuzzle(theme.id)!;
      const ms = performance.now() - t0;
      expect(p.grid).toMatch(/^[A-Z]{48}$/);
      expect(tilingProblems(p.grid, p.words)).toEqual([]);
      // Every cell belongs to exactly one theme word.
      const owner = new Array<number>(CELLS).fill(-1);
      p.words.forEach((w, i) => {
        expect(isPath(w.path)).toBe(true);
        expect(spell(p.grid, w.path)).toBe(w.word);
        for (const c of w.path) {
          expect(owner[c]).toBe(-1);
          owner[c] = i;
        }
        // Findable: the intended path is one of the ways to trace it.
        const keys = tracePaths(p.grid, w.word, 1000).map((q) => [...q].sort((a, b) => a - b).join());
        expect(keys).toContain([...w.path].sort((a, b) => a - b).join());
      });
      expect(owner.every((o) => o >= 0)).toBe(true);
      const spans = p.words.filter((w) => w.span);
      expect(spans).toHaveLength(1);
      expect(spans[0].word).toBe(theme.span.toUpperCase());
      expect(touchesOppositeSides(spans[0].path)).toBe(true);
      expect(gridLines(p.grid).some(containsBlockedSubstring)).toBe(false);
      expect(p.bonus.every((b) => b.length >= 4 && isWord(b))).toBe(true);
      expect(p.bonus.some((b) => p.words.some((w) => w.word.toLowerCase() === b))).toBe(false);
      console.log(`[word-hunt] ${theme.id}: ${ms.toFixed(0)} ms, ${p.bonus.length} bonus words`);
    });
  }

  it("picks a bank theme by date, deterministically, without repeating on consecutive days", () => {
    expect(bankIdForDate("2026-10-24")).toBe(bankIdForDate("2026-10-24"));
    const seen = new Set<string>();
    for (let d = 0; d < BANK.length; d++) {
      seen.add(bankIdForDate(new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10)));
    }
    expect(seen.size).toBe(BANK.length);
  });
});
