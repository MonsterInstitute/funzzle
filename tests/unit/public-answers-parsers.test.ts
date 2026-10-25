import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseLetterBoxedPage,
  parseNerdlePage,
  parseQuordleBundle,
  parseStrands,
  parseWorldle,
  quordleAnswerData,
  quordleNumber,
  quordleWords,
  validateLetterBoxed,
  validateNerdle,
} from "@/scripts/fetch-public-answers.mjs";
import { letterBoxedHints, nerdleHints, quordleHints, strandsHints, worldleHints } from "@/lib/nytHints";

// Real responses saved from each publisher (trimmed of fields we don't read).
const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures/answers", name), "utf8");

describe("Strands (nytimes.com/svc/strands/v2)", () => {
  const json = JSON.parse(fixture("strands-2026-10-24.json"));

  it("parses the theme, spangram and words", () => {
    const d = parseStrands(json, "2026-10-24");
    expect(d).toEqual({
      clue: "Re-fresh-ing",
      spangram: "LAUNDRYDAY",
      words: ["BASKET", "DETERGENT", "DRYER", "IRON", "RACK", "SINK", "WASHER"],
      puzzle_id: 1159,
      editor: "Tracy Bennett",
      constructors: "Christina Iverson",
    });
    expect(strandsHints(d)[0]).toContain("Re-fresh-ing");
  });

  it("rejects the wrong date and broken data", () => {
    expect(() => parseStrands(json, "2026-10-25")).toThrow(/date mismatch/);
    expect(() => parseStrands({ ...json, spangram: "" }, "2026-10-24")).toThrow(/spangram/);
    expect(() => parseStrands({ ...json, themeWords: ["BASKET"] }, "2026-10-24")).toThrow(/theme words/);
  });
});

describe("Letter Boxed (nytimes.com/puzzles/letter-boxed gameData)", () => {
  const days = parseLetterBoxedPage(fixture("letter-boxed-2026-10-24.html"));

  it("reads today's box and NYT's solution", () => {
    expect(days[0]).toEqual({
      date: "2026-10-24",
      answer_data: { sides: ["EPL", "MRH", "SNT", "UKI"], solution: ["METHINKS", "SLURP"], par: 4, puzzle_id: 2881, editor: "Sam Ezersky" },
    });
  });

  it("reads yesterday's box and solution", () => {
    expect(days[1]).toEqual({
      date: "2026-10-23",
      answer_data: { sides: ["ARC", "IGT", "ZEH", "BUN"], solution: ["CHATEAU", "URBANIZING"], par: null, puzzle_id: null, editor: null },
    });
    expect(letterBoxedHints(days[1].answer_data)[0]).toContain("2 words");
  });

  it("rejects solutions that don't play on the box", () => {
    const sides = ["EPL", "MRH", "SNT", "UKI"];
    expect(() => validateLetterBoxed(sides, ["METHINKS", "SLURP"])).not.toThrow();
    expect(() => validateLetterBoxed(sides, ["METHINKS"])).toThrow(/12 letters/);
    expect(() => validateLetterBoxed(sides, ["METHINKS", "PLURS"])).toThrow(/doesn't start/);
    expect(() => validateLetterBoxed(sides, ["MRS"])).toThrow(/same side|one side/);
    expect(() => validateLetterBoxed(sides, ["METHINKZ", "ZLURP"])).toThrow(/not in the box/);
  });

  it("fails on a page without gameData", () => {
    expect(() => parseLetterBoxedPage("<html></html>")).toThrow(/gameData/);
  });
});

describe("Quordle (Merriam-Webster game bundle)", () => {
  const lists = parseQuordleBundle(fixture("quordle-bundle-excerpt.js"));

  it("numbers puzzles by days since 2022-01-24", () => {
    expect(quordleNumber("2026-09-23")).toBe(1703);
    expect(quordleNumber("2025-10-23")).toBe(1368);
  });

  it("reproduces published daily answers", () => {
    // Checked against answer sites (Analytics Insight, TechRadar, Of Zen and Computing).
    expect(quordleWords(1703, lists)).toEqual(["SHEET", "BLAND", "JOIST", "GUAVA"]);
    expect(quordleWords(1368, lists)).toEqual(["FLOSS", "VIRAL", "AORTA", "FERRY"]);
    expect(quordleWords(1387, lists)).toEqual(["SHIRK", "TEPID", "TREAT", "FAULT"]);
    expect(quordleAnswerData("2026-10-24", lists)).toEqual({ number: 1734, words: ["TOXIN", "SMART", "MOUSE", "STYLE"] });
    expect(quordleHints({ number: 1734, words: ["TOXIN", "SMART", "MOUSE", "STYLE"] })[0]).toContain("T, S, M, S");
  });

  it("fails loudly when the bundle's word list changes", () => {
    const shuffled = { ...lists, wordBank: [...lists.wordBank].reverse() };
    expect(() => quordleAnswerData("2026-10-24", shuffled)).toThrow(/no longer reproduces/);
    expect(() => parseQuordleBundle("const x = 1;")).toThrow(/not found/);
  });
});

describe("Worldle (cdn-assets.teuteuf.fr)", () => {
  const countries = JSON.parse(fixture("worldle-countries-excerpt.json"));

  it("maps the day's country code to its name", () => {
    const d = parseWorldle(JSON.parse(fixture("worldle-2026-06-28.json")), countries);
    expect(d).toMatchObject({ country_code: "AE", country: "United Arab Emirates" });
    expect(worldleHints(d)[0]).toBe("It lies in the Northern Hemisphere, east of the Prime Meridian.");
  });

  it("rejects unknown codes", () => {
    expect(() => parseWorldle({ countryCode: "ZZ" }, countries)).toThrow(/not in countries/);
    expect(() => parseWorldle({}, countries)).toThrow(/bad country code/);
  });
});

describe("Nerdle (nerdlegame.com official answer pages)", () => {
  const html = fixture("nerdle-2026-10-23.html");

  it("reads the equation and game number", () => {
    const d = parseNerdlePage(html, "2026-10-23");
    expect(d).toEqual({ equation: "21/7+5=8", number: 1738 });
    expect(nerdleHints(d)).toEqual(["The left side uses 2 operators: ÷ then +.", "The result after the = sign is 8."]);
  });

  it("rejects a page for another date", () => {
    expect(() => parseNerdlePage(html, "2026-10-24")).toThrow(/not for/);
  });

  it("checks the equation computes, with exact fractions", () => {
    expect(() => validateNerdle("3/21*7=1")).not.toThrow();
    expect(() => validateNerdle("7*4-3=25")).not.toThrow();
    expect(() => validateNerdle("7*4-3=26")).toThrow(/doesn't compute/);
    expect(() => validateNerdle("12+3=15")).toThrow(/8-character/);
  });
});
