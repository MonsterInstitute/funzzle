import { describe, expect, it } from "vitest";
import { createRng } from "../kit/rng";
import { isBlocked, containsBlockedSubstring, BLOCKED_STEMS, BLOCKED_EXACT } from "./blocklist";
import {
  isCommon,
  isWord,
  letterMask,
  matchPattern,
  MAX_WORD_LENGTH,
  MIN_WORD_LENGTH,
  pangramCandidates,
  wordsFromLetters,
  wordsOfLength,
} from "./lexicon";
import { packWords, PackedWords } from "./packed";
import { ANSWERS5, VALID5, isAnswer5, isValid5, pickAnswers5 } from "./words5";
import * as L05 from "./data/len05";

const lengths = Array.from({ length: MAX_WORD_LENGTH - MIN_WORD_LENGTH + 1 }, (_, i) => i + MIN_WORD_LENGTH);

describe("packing", () => {
  it("packWords / PackedWords round-trip deterministically", () => {
    const words = ["crane", "about", "zebra", "about", "mango"];
    const packed = packWords(words, 5);
    expect(packed).toBe("aboutcranemangozebra");
    expect(packWords(new PackedWords(packed, 5).toArray().reverse(), 5)).toBe(packed);
    const list = new PackedWords(packed, 5);
    expect(list.size).toBe(4);
    expect(list.at(2)).toBe("mango");
    expect(list.indexOf("ZEBRA")).toBe(3);
    expect(list.has("crank")).toBe(false);
    expect(list.has("abou")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(() => packWords(["Crane"], 5)).toThrow();
    expect(() => packWords(["cran"], 5)).toThrow();
    expect(() => new PackedWords("abcd", 5)).toThrow();
  });

  it("generated data is sorted, unique, a-z and re-packs to itself", () => {
    for (const len of lengths) {
      const common = wordsOfLength(len, "common").toArray();
      const valid = wordsOfLength(len, "valid").toArray();
      const extra = valid.slice(common.length);
      expect(packWords(common, len)).toBe(common.join(""));
      expect(packWords(extra, len)).toBe(extra.join(""));
      expect(new Set(valid).size).toBe(valid.length); // tiers are disjoint
    }
    expect(packWords(ANSWERS5.toArray(), 5)).toBe(ANSWERS5.packed);
    expect(new Set(VALID5.toArray()).size).toBe(VALID5.size);
  });
});

describe("blocklist", () => {
  it("is well-formed", () => {
    for (const w of [...BLOCKED_STEMS, ...BLOCKED_EXACT]) expect(w).toMatch(/^[a-z]+$/);
  });

  it("never intersects answers, common, valid or guess lists", () => {
    expect(ANSWERS5.toArray().filter(isBlocked)).toEqual([]);
    expect(VALID5.toArray().filter(isBlocked)).toEqual([]);
    for (const len of lengths) {
      expect(wordsOfLength(len, "valid").toArray().filter(isBlocked)).toEqual([]);
    }
    for (const w of BLOCKED_STEMS) {
      expect(isWord(w)).toBe(false);
      expect(isValid5(w)).toBe(false);
    }
  });

  it("blocks inflections but not innocent neighbours", () => {
    const stem = BLOCKED_STEMS.find((w) => w.length >= 4 && /[^aeiouy]$/.test(w))!;
    expect(isBlocked(stem + "s")).toBe(true);
    expect(isBlocked(stem + "ing")).toBe(true);
    expect(isBlocked(stem.toUpperCase())).toBe(true);
    for (const ok of ["butter", "spicy", "shaggy", "bonkers", "grape", "scrape", "therapy", "peacock", "cocktail", "wristwatch", "saltwater", "raps", "pubs", "heroine", "honking", "crane"]) {
      expect(isBlocked(ok), ok).toBe(false);
    }
    expect(containsBlockedSubstring("xqzvw")).toBe(false);
  });
});

describe("five-letter lists", () => {
  it("sizes are in range", () => {
    expect(ANSWERS5.size).toBeGreaterThan(1800);
    expect(ANSWERS5.size).toBeLessThan(3000);
    expect(VALID5.size).toBeGreaterThan(8000);
    expect(VALID5.size).toBeLessThan(13000);
  });

  it("every answer is a valid guess and a common word", () => {
    for (const w of ANSWERS5.toArray()) {
      expect(isValid5(w)).toBe(true);
      expect(isCommon(w)).toBe(true);
    }
  });

  it("knows familiar words, case-insensitively", () => {
    for (const w of ["crane", "slate", "audio", "about", "pizza", "ghost", "Light", "QUEEN"]) {
      expect(isValid5(w), w).toBe(true);
    }
    for (const w of ["crane", "ghost", "lemon", "tiger", "ocean"]) expect(isAnswer5(w), w).toBe(true);
    // Scrabble-only words are accepted guesses but never answers.
    expect(isValid5("aahed")).toBe(true);
    expect(isAnswer5("aahed")).toBe(false);
    for (const w of ["xxxxx", "crain", "abcde", "cran", "cranes", "cra e"]) expect(isValid5(w), w).toBe(false);
  });

  it("answers skip plain inflections", () => {
    for (const w of ["cats", "bears", "baked", "tries", "aging"].filter((w) => w.length === 5)) {
      expect(isAnswer5(w), w).toBe(false);
    }
    expect(isValid5("bears")).toBe(true);
  });

  it("pickAnswers5 is deterministic and distinct", () => {
    const a = pickAnswers5(createRng("quad:2026-10-24"), 4);
    expect(pickAnswers5(createRng("quad:2026-10-24"), 4)).toEqual(a);
    expect(new Set(a).size).toBe(4);
    for (const w of a) expect(isAnswer5(w)).toBe(true);
  });

  it("words5 shares data with the lexicon", () => {
    expect(new PackedWords(L05.COMMON, 5).toArray()).toEqual(wordsOfLength(5, "common").toArray());
  });
});

describe("lexicon", () => {
  it("sizes are in range", () => {
    let common = 0;
    let valid = 0;
    for (const len of lengths) {
      common += wordsOfLength(len, "common").size;
      valid += wordsOfLength(len, "valid").size;
    }
    expect(common).toBeGreaterThan(30000);
    expect(common).toBeLessThan(45000);
    expect(valid).toBeGreaterThan(55000);
    expect(valid).toBeLessThan(70000);
    expect(wordsOfLength(2).size).toBe(0);
    expect(wordsOfLength(16).size).toBe(0);
  });

  it("knows words of many lengths", () => {
    for (const w of ["cat", "tree", "house", "garden", "elephant", "beautiful", "strawberry", "information", "Responsibility"]) {
      expect(isWord(w), w).toBe(true);
      expect(isCommon(w), w).toBe(true);
    }
    for (const w of ["qwerty", "zzzz", "", "a", "can't", "e-mail", "elephants1"]) expect(isWord(w), w).toBe(false);
    // Proper nouns and abbreviations are not words.
    for (const w of ["london", "paris", "usa", "nasa"]) expect(isWord(w), w).toBe(false);
  });

  it("common is a subset of valid", () => {
    for (const len of [4, 7, 10]) {
      for (const w of wordsOfLength(len, "common").toArray()) expect(isWord(w)).toBe(true);
    }
  });

  it("letterMask", () => {
    expect(letterMask("abc")).toBe(0b111);
    expect(letterMask("aaZ")).toBe(1 | (1 << 25));
    expect(letterMask("a-b")).toBe(-1);
  });

  it("wordsFromLetters: Spelling Hive rules", () => {
    const letters = "tracein"; // center: t
    const words = wordsFromLetters(letters, { minLength: 4, mustInclude: "t", tier: "common" });
    expect(words.length).toBeGreaterThan(30);
    const allowed = new Set(letters);
    for (const w of words) {
      expect(w.length).toBeGreaterThanOrEqual(4);
      expect(w).toContain("t");
      for (const ch of w) expect(allowed.has(ch)).toBe(true);
      expect(isCommon(w)).toBe(true);
    }
    for (const w of ["train", "tent", "certain", "attain"]) expect(words, w).toContain(w);
    expect(words).not.toContain("rain"); // no center letter
    expect(words).not.toContain("tan"); // too short
    // sorted by length then alphabetically
    const sorted = [...words].sort((a, b) => a.length - b.length || a.localeCompare(b));
    expect(words).toEqual(sorted);
    // brute-force cross-check against the full tier
    const brute: string[] = [];
    for (let len = 4; len <= MAX_WORD_LENGTH; len++) {
      for (const w of wordsOfLength(len, "common").toArray()) {
        if (w.includes("t") && [...w].every((c) => allowed.has(c))) brute.push(w);
      }
    }
    expect(new Set(words)).toEqual(new Set(brute));
  });

  it("wordsFromLetters: no reuse (anagram mode)", () => {
    const words = wordsFromLetters("listen", { reuse: false });
    expect(words).toContain("silent");
    expect(words).toContain("tinsel");
    expect(words).toContain("lens");
    expect(words).not.toContain("tennis"); // needs two n's
    for (const w of words) expect(w.length).toBeLessThanOrEqual(6);
    expect(wordsFromLetters("listen", { reuse: true })).toContain("tennis");
  });

  it("pangramCandidates", () => {
    const p = pangramCandidates({ excludeLetters: "s" });
    expect(p.length).toBeGreaterThan(1000);
    for (const w of p.slice(0, 200)) {
      expect(new Set(w).size).toBe(7);
      expect(w).not.toContain("s");
    }
    expect(p).toContain("captive");
    expect(p).not.toContain("strange");
  });

  it("matchPattern", () => {
    const m = matchPattern("cr.n.");
    expect(m).toContain("crane");
    for (const w of m) expect(w).toMatch(/^cr.n.$/);
    expect(matchPattern("?????").length).toBe(wordsOfLength(5).size);
  });
});
