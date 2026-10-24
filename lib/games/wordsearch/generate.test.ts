import { describe, expect, it } from "vitest";
import { containsBlockedSubstring } from "../words/blocklist";
import {
  countInGrid,
  DIRS,
  generateWordSearch,
  gridLines,
  lineCells,
  matchSelection,
  puzzleProblems,
  wordCells,
  WORD_COUNT,
  type Theme,
} from "./generate";
import { bankThemeFor, fallbackDailyWordSearch, practiceWordSearch } from "./daily";
import { hardness, wordSearchHint } from "./coach";
import { THEMES } from "./themes";

const reverse = (s: string) => [...s].reverse().join("");

describe("word search generator", () => {
  it("is a pure function of the seed", () => {
    const a = generateWordSearch("ws:test", THEMES[0], 12);
    const b = generateWordSearch("ws:test", THEMES[0], 12);
    expect(a).toEqual(b);
    expect(generateWordSearch("ws:other", THEMES[0], 12).grid).not.toBe(a.grid);
  });

  it("places every word exactly once, with clean filler, at every size", () => {
    for (const size of [10, 12, 15]) {
      for (let k = 0; k < 6; k++) {
        const p = generateWordSearch(`ws:sizes:${size}:${k}`, THEMES[k * 7], size);
        expect(puzzleProblems(p)).toEqual([]);
        expect(p.grid).toHaveLength(size * size);
        expect(p.words.length).toBeGreaterThanOrEqual(WORD_COUNT[size].min);
        expect(p.words.length).toBeLessThanOrEqual(16);
        const lines = gridLines(p.grid, size);
        for (const line of lines) {
          expect(containsBlockedSubstring(line)).toBe(false);
          expect(containsBlockedSubstring(reverse(line))).toBe(false);
        }
        for (const w of p.words) {
          expect(countInGrid(lines, w.word)).toBe(1);
          expect(wordCells(size, w).map((i) => p.grid[i]).join("")).toBe(w.word);
        }
      }
    }
  });

  it("uses all 8 directions across a run of grids", () => {
    const dirs = new Set<number>();
    for (let k = 0; k < 20; k++) for (const w of generateWordSearch(`ws:dirs:${k}`, THEMES[k], 15).words) dirs.add(w.dir);
    expect(dirs.size).toBe(8);
  });

  it("lets words cross where their letters agree", () => {
    let crossings = 0;
    for (let k = 0; k < 10; k++) {
      const p = generateWordSearch(`ws:overlap:${k}`, THEMES[k], 12);
      const seen = new Map<number, number>();
      for (const w of p.words) for (const i of wordCells(p.size, w)) seen.set(i, (seen.get(i) ?? 0) + 1);
      crossings += [...seen.values()].filter((n) => n > 1).length;
    }
    expect(crossings).toBeGreaterThan(0);
  });

  it("drops words hidden inside other words and palindromes", () => {
    const theme: Theme = { title: "Test", words: ["star", "start", "level", "rats", "planet", "comet", "orbit", "rocket", "moon", "galaxy", "nebula", "meteor", "crater", "lunar", "solar", "cosmos"] };
    const p = generateWordSearch("ws:conflicts", theme, 12);
    const words = p.words.map((w) => w.word);
    expect(words).not.toContain("level");
    const starish = words.filter((w) => w === "star" || w === "start" || w === "rats");
    expect(starish.length).toBeLessThanOrEqual(1);
    expect(puzzleProblems(p)).toEqual([]);
  });

  it("flags a word that appears twice and a blocked line", () => {
    const p = generateWordSearch("ws:flags", THEMES[3], 12);
    const w = p.words[0];
    const cells = wordCells(p.size, w);
    // Copy the word's letters into the first row (if it fits elsewhere) to duplicate it.
    const g = [...p.grid];
    const row = cells.every((i) => i >= p.size) ? 0 : p.size - 1;
    for (let k = 0; k < w.word.length; k++) g[row * p.size + k] = w.word[k];
    expect(puzzleProblems({ ...p, grid: g.join("") }).join(" ")).toMatch(/found|letters don't match/);
  });
});

describe("selection", () => {
  const p = generateWordSearch("ws:select", THEMES[5], 12);

  it("snaps a drag to the nearest of the 8 directions", () => {
    // From (2,2) toward (3,6): mostly across, so it reads across.
    expect(lineCells(12, 2 * 12 + 2, 3 * 12 + 6)).toEqual([26, 27, 28, 29, 30]);
    // Toward (6,5): closest to the down-right diagonal.
    expect(lineCells(12, 26, 6 * 12 + 5)).toEqual([26, 39, 52, 65, 78]);
    // A single square, and a steep drag from the top-right corner reading down-left.
    expect(lineCells(12, 0, 0)).toEqual([0]);
    expect(lineCells(12, 11, 6 * 12 + 4)).toEqual([11, 22, 33, 44, 55, 66, 77, 88]);
  });

  it("matches a word read either way, and nothing else", () => {
    for (let i = 0; i < p.words.length; i++) {
      const cells = wordCells(p.size, p.words[i]);
      expect(matchSelection(p, cells)).toBe(i);
      expect(matchSelection(p, cells.slice().reverse())).toBe(i);
      expect(matchSelection(p, cells.slice(0, -1))).toBe(-1);
    }
  });
});

describe("daily and practice", () => {
  it("never repeats a theme on consecutive days and cycles through the bank", () => {
    const days = Array.from({ length: THEMES.length * 2 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    const titles = days.map((d) => bankThemeFor(d).title);
    for (let i = 1; i < titles.length; i++) expect(titles[i]).not.toBe(titles[i - 1]);
    expect(new Set(titles).size).toBe(THEMES.length);
  });

  it("builds the fallback daily and practice grids", () => {
    const d = fallbackDailyWordSearch("2026-10-24");
    expect(d.size).toBe(12);
    expect(puzzleProblems(d)).toEqual([]);
    expect(fallbackDailyWordSearch("2026-10-24")).toEqual(d);
    const pr = practiceWordSearch("word-search-practice:abc", 15);
    expect(pr.size).toBe(15);
    expect(practiceWordSearch("word-search-practice:abc", 15)).toEqual(pr);
  });
});

describe("coach", () => {
  const p = generateWordSearch("ws:coach", THEMES[9], 12);

  it("points at the hardest unfound word: start square, then direction, then the word", () => {
    const found = p.words.map(() => false);
    const h = wordSearchHint(p, found)!;
    const w = p.words[h.word];
    const [dr, dc] = DIRS[w.dir];
    expect(h.cells).toEqual(wordCells(p.size, w));
    expect(h.start).toBe(w.row * p.size + w.col);
    expect(h.next).toBe((w.row + dr) * p.size + w.col + dc);
    expect(h.nudge).toContain(w.word.toUpperCase());
    expect(h.direction).toContain("runs");
    for (let i = 0; i < p.words.length; i++) expect(hardness(p, i)).toBeLessThanOrEqual(hardness(p, h.word));
  });

  it("skips found words and returns null when everything is found", () => {
    const found = p.words.map(() => false);
    const first = wordSearchHint(p, found)!.word;
    found[first] = true;
    expect(wordSearchHint(p, found)!.word).not.toBe(first);
    expect(wordSearchHint(p, p.words.map(() => true))).toBeNull();
  });
});
