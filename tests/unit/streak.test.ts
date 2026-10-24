import { beforeEach, describe, expect, it } from "vitest";
import { getStreak, markDone, shiftDay } from "@/lib/games/kit/daily";

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  (globalThis as { window?: unknown }).window = globalThis;
});

const play = (from: string, days: number) => {
  for (let i = 0; i < days; i++) markDone("sudoku", shiftDay(from, i));
};

describe("streak freezes", () => {
  it("earns a freeze every 7 days and spends it on a missed day", () => {
    play("2026-10-01", 7); // Oct 1–7: 7-day streak, 1 freeze
    // Oct 8 missed → freeze covers it
    play("2026-10-09", 3); // Oct 9–11
    const s = getStreak("2026-10-11");
    expect(s.current).toBe(10);
    expect(s.frozen).toEqual(["2026-10-08"]);
    expect(s.freezes).toBe(0);
  });
  it("breaks the streak when no freeze is banked", () => {
    play("2026-10-01", 3);
    play("2026-10-05", 2); // Oct 4 missed, no freeze
    expect(getStreak("2026-10-06").current).toBe(2);
    expect(getStreak("2026-10-06").best).toBe(3);
  });
  it("today not played yet keeps the streak; caps freezes at 2", () => {
    play("2026-10-01", 21); // 3 milestones → capped at 2
    const s = getStreak("2026-10-22");
    expect(s.current).toBe(21);
    expect(s.freezes).toBe(2);
  });
});
