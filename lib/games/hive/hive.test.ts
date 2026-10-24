import { describe, expect, it } from "vitest";
import { isBlocked } from "@/lib/games/words/blocklist";
import { isCommon, isWord } from "@/lib/games/words/lexicon";
import { generateHive, MAX_ANSWERS, MIN_ANSWERS } from "./generate";
import {
  checkWord,
  GENIUS,
  hintGrid,
  hiveHint,
  isPangram,
  letterSet,
  maxScoreOf,
  missedPattern,
  rankIndex,
  rankThresholds,
  RANKS,
  scoreOf,
  TOP,
  wordPattern,
  wordScore,
  type HivePuzzle,
} from "./index";

const dates = (n: number, from = "2026-10-01") =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

describe("generateHive", () => {
  it("is a pure function of the seed", () => {
    expect(generateHive("spelling-hive:2026-10-24")).toEqual(generateHive("spelling-hive:2026-10-24"));
    expect(generateHive("spelling-hive:2026-10-24")).not.toEqual(generateHive("spelling-hive:2026-10-25"));
  });

  it("makes a valid hive for every day of a year", () => {
    const t0 = performance.now();
    const days = dates(366);
    for (const date of days) {
      const p = generateHive(`spelling-hive:${date}`);
      const letters = letterSet(p);
      expect(letters.size, date).toBe(7);
      expect(p.outer).toHaveLength(6);
      expect(letters.has("s"), date).toBe(false);
      expect(p.answers.length, date).toBeGreaterThanOrEqual(MIN_ANSWERS);
      expect(p.answers.length, date).toBeLessThanOrEqual(MAX_ANSWERS);
      expect(p.pangrams.length, date).toBeGreaterThanOrEqual(1);
      expect([...p.answers].sort()).toEqual(p.answers);
      expect([...p.bonus].sort()).toEqual(p.bonus);
      const answers = new Set(p.answers);
      for (const w of p.answers) {
        expect(w.length).toBeGreaterThanOrEqual(4);
        expect(w.includes(p.center), w).toBe(true);
        expect([...w].every((c) => letters.has(c)), w).toBe(true);
        expect(isCommon(w), w).toBe(true);
        expect(isBlocked(w), w).toBe(false);
      }
      for (const w of p.bonus) {
        expect(answers.has(w), w).toBe(false);
        expect(w.includes(p.center) && [...w].every((c) => letters.has(c)), w).toBe(true);
        expect(isWord(w) && !isCommon(w) && !isBlocked(w), w).toBe(true);
      }
      for (const w of p.pangrams) expect(answers.has(w) && isPangram(w, letters)).toBe(true);
      expect(p.answers.filter((w) => isPangram(w, letters))).toEqual(p.pangrams);
      expect(p.maxScore).toBe(maxScoreOf(p.answers, letters));
    }
    const ms = (performance.now() - t0) / days.length;
    console.log(`spelling hive: ${ms.toFixed(1)} ms per daily hive`);
    expect(ms).toBeLessThan(200);
  });

  it("uses many different letter sets", () => {
    const sets = new Set(dates(60).map((d) => [...letterSet(generateHive(`spelling-hive:${d}`))].sort().join("")));
    expect(sets.size).toBeGreaterThan(55);
  });
});

/** A small hand-made hive for rule tests. */
const HIVE: HivePuzzle = {
  center: "a",
  outer: "bcdelt",
  answers: ["abet", "able", "cable", "cablet", "tablet", "table", "dealt"].sort(),
  bonus: ["blat"],
  pangrams: [],
  maxScore: 0,
};
HIVE.pangrams = HIVE.answers.filter((w) => isPangram(w, letterSet(HIVE)));
HIVE.maxScore = maxScoreOf(HIVE.answers, letterSet(HIVE));

describe("rules and scoring", () => {
  it("scores 1 for four letters, length beyond, +7 for a pangram", () => {
    const L = letterSet({ center: "a", outer: "bcdelt" });
    expect(wordScore("abet", L)).toBe(1);
    expect(wordScore("table", L)).toBe(5);
    expect(wordScore("cablted", L)).toBe(14);
    expect(wordScore("abc", L)).toBe(0);
  });

  it("checks words with friendly reasons", () => {
    expect(checkWord(HIVE, [], "TABLE")).toEqual({ ok: true, kind: "answer", points: 5, pangram: false });
    expect(checkWord(HIVE, [], "blat")).toEqual({ ok: true, kind: "bonus" });
    expect(checkWord(HIVE, [], "tab")).toEqual({ ok: false, reason: "short" });
    expect(checkWord(HIVE, [], "belt")).toEqual({ ok: false, reason: "center" });
    expect(checkWord(HIVE, [], "taxes")).toEqual({ ok: false, reason: "letters" });
    expect(checkWord(HIVE, [], "tabla")).toEqual({ ok: false, reason: "unknown" });
    expect(checkWord(HIVE, ["table"], "table")).toEqual({ ok: false, reason: "found" });
  });

  it("only answers count toward the score", () => {
    expect(scoreOf(["table", "blat", "abet"], HIVE)).toBe(6);
  });

  it("ranks by share of the maximum, top rank only with every word", () => {
    const max = 200;
    const t = rankThresholds(max);
    expect(t[0]).toBe(0);
    expect(t[TOP]).toBe(max);
    expect(rankIndex(0, max)).toBe(0);
    expect(RANKS[rankIndex(140, max)].name).toBe("Genius");
    expect(rankIndex(199, max)).toBe(GENIUS);
    expect(RANKS[rankIndex(200, max)].name).toBe("Hive Master");
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });

  it("builds the hints grid and two-letter list from words left", () => {
    const g = hintGrid(HIVE, ["table"]);
    expect(g.lengths).toEqual([4, 5, 6]);
    const t = g.rows.find((r) => r.letter === "t")!;
    expect(t.counts).toEqual([0, 0, 1]);
    expect(g.totals.reduce((a, b) => a + b, 0)).toBe(HIVE.answers.length - 1);
    expect(g.twoLetter.find((x) => x.prefix === "ta")!.left).toBe(1);
  });
});

describe("coach", () => {
  it("shows a definition-free pattern", () => {
    expect(wordPattern("train")).toBe("T _ _ _ N");
  });

  it("aims for a pangram first, then the busiest two-letter start", () => {
    const p = generateHive("spelling-hive:2026-10-24");
    const first = hiveHint(p, [])!;
    expect(first.pangram).toBe(true);
    expect(p.pangrams).toContain(first.word);
    expect(first.nudge).toContain(first.word.slice(0, 2).toUpperCase());
    const next = hiveHint(p, [first.word])!;
    expect(next.word).not.toBe(first.word);
    expect(next.nudge).toMatch(/starting with [A-Z]{2}/);
  });

  it("following the coach finds every answer", () => {
    for (const date of dates(10)) {
      const p = generateHive(`spelling-hive:${date}`);
      const found: string[] = [];
      for (let i = 0; i < p.answers.length; i++) {
        const h = hiveHint(p, found)!;
        expect(checkWord(p, found, h.word).ok).toBe(true);
        found.push(h.word);
      }
      expect(hiveHint(p, found)).toBeNull();
      expect(rankIndex(scoreOf(found, p), p.maxScore)).toBe(TOP);
    }
  });

  it("names the most-missed pattern", () => {
    expect(missedPattern(["baking", "taking", "cake"])?.label).toBe("-ING");
    expect(missedPattern(["cake"])).toBeNull();
  });
});
