import { describe, expect, it } from "vitest";
import { shiftDay } from "@/lib/games/kit/daily";
import { ANSWERS5 } from "@/lib/games/words/words5";
import { containsBlockedSubstring } from "@/lib/games/words/blocklist";
import { GEO_ANSWERS, GEO_GAP, geoAnswer } from "./geoData";
import { mathAnswer } from "./math";
import { dayIndex, EPOCH, scheduledIndex } from "./schedule";
import { classicAnswer, quadAnswers, quadAnswersFromSeed } from "./words";

/** Smallest distance in days between two days with the same item. */
function minRepeatGap(items: string[]): number {
  const last = new Map<string, number>();
  let min = Infinity;
  items.forEach((x, d) => {
    if (last.has(x)) min = Math.min(min, d - last.get(x)!);
    last.set(x, d);
  });
  return min;
}

describe("scheduledIndex", () => {
  it("never repeats within the gap, across many cycles and pool sizes", () => {
    for (const [size, gap] of [
      [30, 10],
      [31, 7],
      [100, 33],
    ]) {
      const days = Array.from({ length: size * 12 }, (_, d) => String(scheduledIndex(`t:${size}`, size, d - size * 2, gap)));
      expect(minRepeatGap(days)).toBeGreaterThan(gap);
      // Every item still comes up once per cycle.
      expect(new Set(days.slice(0, size * 3)).size).toBe(size);
    }
  });

  it("rejects a gap the pool can't support", () => {
    expect(() => scheduledIndex("t", 10, 0, 4)).toThrow(RangeError);
  });

  it("counts days from the epoch", () => {
    expect(dayIndex(EPOCH)).toBe(0);
    expect(dayIndex("2026-10-24")).toBe(296);
    expect(dayIndex("2025-12-31")).toBe(-1);
  });
});

describe("daily answers", () => {
  const start = "2026-01-01";
  const dates = Array.from({ length: 6 * 365 }, (_, i) => shiftDay(start, i));

  it("classic: deterministic, from the answer pool, no repeat within a year (6 years checked)", () => {
    const words = dates.map(classicAnswer);
    expect(classicAnswer("2026-10-24")).toBe(words[dayIndex("2026-10-24")]);
    for (const w of words) {
      expect(ANSWERS5.has(w)).toBe(true);
      expect(containsBlockedSubstring(w)).toBe(false);
    }
    expect(minRepeatGap(words)).toBeGreaterThan(366);
  });

  it("quad: four distinct answers, never today's classic word", () => {
    for (const d of dates.slice(0, 400)) {
      const q = quadAnswers(d);
      expect(new Set(q).size).toBe(4);
      expect(q).not.toContain(classicAnswer(d));
      q.forEach((w) => expect(ANSWERS5.has(w)).toBe(true));
    }
    expect(quadAnswersFromSeed("x")).toEqual(quadAnswersFromSeed("x"));
  });

  it("math: no repeat within a year", () => {
    expect(minRepeatGap(dates.slice(0, 3 * 365).map(mathAnswer))).toBeGreaterThan(366);
  });

  it("geo: every answer has a silhouette; no repeat within the gap", () => {
    expect(GEO_ANSWERS.length).toBeGreaterThan(150);
    expect(GEO_GAP).toBeGreaterThanOrEqual(50);
    const slugs = dates.slice(0, 3 * 365).map((d) => geoAnswer(d).slug);
    expect(minRepeatGap(slugs)).toBeGreaterThan(GEO_GAP);
    for (const d of dates.slice(0, 30)) expect(geoAnswer(d).shape).toMatch(/^M\d/);
  });
});
