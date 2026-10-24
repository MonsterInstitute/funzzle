import { beforeEach, describe, expect, it } from "vitest";
import { railFor } from "@/components/ads/GameRails";
import { countPractice, FREE_PRACTICE, practiceLocked, UNLOCK, unlockPractice } from "@/lib/games/kit/practiceQuota";

describe("railFor", () => {
  it("keeps 64 px between a rail and the 520 px board", () => {
    expect(railFor(1023, 520)).toBe("none");
    expect(railFor(1024, 520)).toBe("narrow");
    expect(railFor(1279, 520)).toBe("narrow");
    expect(railFor(1280, 520)).toBe("wide");
  });
  it("needs more room beside a wider board", () => {
    expect(railFor(1100, 672)).toBe("none");
    expect(railFor(1152, 672)).toBe("narrow");
    expect(railFor(1432, 672)).toBe("wide");
  });
  it("never shows on phones or tablets", () => {
    expect(railFor(390, 520)).toBe("none");
    expect(railFor(820, 320)).toBe("none");
  });
});

describe("practice quota", () => {
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
  it("locks after the free puzzles and unlocks more", () => {
    for (let i = 0; i < FREE_PRACTICE; i++) {
      expect(practiceLocked("sudoku")).toBe(false);
      countPractice("sudoku");
    }
    expect(practiceLocked("sudoku")).toBe(true);
    unlockPractice("sudoku");
    for (let i = 0; i < UNLOCK; i++) {
      expect(practiceLocked("sudoku")).toBe(false);
      countPractice("sudoku");
    }
    expect(practiceLocked("sudoku")).toBe(true);
    expect(practiceLocked("solitaire")).toBe(false);
  });
});
