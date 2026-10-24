import { beforeEach, describe, expect, it } from "vitest";

// Minimal browser storage for the local-progress modules.
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    dispatchEvent: () => true,
  },
  CustomEvent: class {},
});

const { getStreak, markDone, setStatus, getStatus, dailySetProgress, shiftDay } = await import("@/lib/games/kit/daily");
const { matchScore, ratingDelta, recordMatch, getRating } = await import("@/lib/games/kit/rating");

beforeEach(() => store.clear());

describe("daily set and streaks", () => {
  it("counts consecutive days with any Daily Set finish", () => {
    const today = "2026-10-24";
    markDone("sudoku", shiftDay(today, -2));
    markDone("word", shiftDay(today, -1));
    expect(getStreak(today).current).toBe(2); // today not played yet keeps the streak
    markDone("solitaire", today);
    expect(getStreak(today).current).toBe(3);
    expect(getStreak(shiftDay(today, 2)).current).toBe(0);
    expect(getStreak(today).best).toBe(3);
  });

  it("ignores games outside the Daily Set and never downgrades a finish", () => {
    const today = "2026-10-24";
    markDone("chess", today);
    expect(getStreak(today).current).toBe(0);
    markDone("sudoku", today);
    setStatus("sudoku", today, { state: "playing" });
    expect(getStatus("sudoku", today)?.state).toBe("done");
    expect(dailySetProgress(today)).toBe(1);
  });

  it("marks the week", () => {
    const week = getStreak("2026-10-24").week; // Saturday
    expect(week).toHaveLength(7);
    expect(week[5]).toBe("today");
    expect(week[6]).toBe("future");
  });
});

describe("rating", () => {
  it("rewards fast, clean solves and penalises help", () => {
    const base = { puzzleRating: 1600, won: true, hints: 0, mistakes: 0 };
    expect(matchScore({ ...base, percentile: 90 })).toBeGreaterThan(matchScore({ ...base, percentile: 10 }));
    expect(matchScore({ ...base, hints: 3 })).toBeLessThan(matchScore(base));
    expect(matchScore({ ...base, won: false })).toBe(0);
    expect(ratingDelta(1200, { ...base, percentile: 90 })).toBeGreaterThan(0);
  });

  it("applies one match per puzzle", () => {
    const input = { puzzleRating: 1300, won: true, hints: 0, mistakes: 0, percentile: 80 };
    const first = recordMatch("sudoku", "2026-10-24", input);
    const again = recordMatch("sudoku", "2026-10-24", input);
    expect(again).toEqual(first);
    expect(getRating("sudoku").games).toBe(1);
  });
});
