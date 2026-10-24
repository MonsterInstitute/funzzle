import { describe, expect, it } from "vitest";
import { isBlocked } from "../words/blocklist";
import { isWord } from "../words/lexicon";
import { generateWordSearch, puzzleProblems, SIZES } from "./generate";
import { THEMES } from "./themes";
import { cleanThemeWords, themeProblems } from "./validate";

describe("word search theme bank", () => {
  it("has at least 40 original themes with unique titles", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(THEMES.map((t) => t.title)).size).toBe(THEMES.length);
  });

  it("uses only dictionary words of 3–12 letters, nothing blocked", () => {
    for (const t of THEMES) {
      expect(themeProblems(t), t.title).toEqual([]);
      for (const w of t.words) {
        expect(isWord(w), `${t.title}: ${w}`).toBe(true);
        expect(isBlocked(w), `${t.title}: ${w}`).toBe(false);
        expect(w).toMatch(/^[a-z]{3,12}$/);
      }
    }
  });

  it("fills a valid grid at every size for every theme", () => {
    for (const t of THEMES) {
      for (const size of SIZES) {
        const p = generateWordSearch(`bank:${t.title}:${size}`, t, size);
        expect(puzzleProblems(p), `${t.title} ${size}`).toEqual([]);
      }
    }
  });
});

describe("theme validation", () => {
  it("cleans model output: case, spaces, non-words, blocked words and duplicates", () => {
    expect(cleanThemeWords(["Apple", " pear ", "ice cream", "zzqx", "apple", 42, "ab", "shit"])).toEqual(["apple", "pear"]);
  });

  it("rejects thin or junk themes", () => {
    expect(themeProblems({ title: "Fruit", words: ["apple", "pear"] }).join()).toMatch(/only 2 usable/);
    expect(themeProblems({ title: "<b>x</b>", words: THEMES[0].words }).join()).toMatch(/title/);
  });
});
