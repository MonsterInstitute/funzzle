import { describe, expect, it } from "vitest";
import { DIFFICULTIES, SIZES, adjacentCounts, neighbors, newGame } from "./board";
import { solveLayout } from "./solver";
import { centerCell, dailyBoard, generateBoard, placeMines, transposeBoard } from "./generate";

/** First clicks to try: centre, a corner and an edge cell. */
function clicks(width: number, height: number): number[] {
  return [Math.floor(height / 2) * width + Math.floor(width / 2), 0, (height - 1) * width + Math.floor(width / 3)];
}

describe("generateBoard", () => {
  it("is deterministic per seed, difficulty and first click", () => {
    for (const d of DIFFICULTIES) {
      const c = centerCell(d);
      expect(generateBoard("ms:2026-10-24", d, c)).toEqual(generateBoard("ms:2026-10-24", d, c));
    }
    const a = generateBoard("ms:2026-10-24", "intermediate", 0);
    expect(generateBoard("ms:2026-10-25", "intermediate", 0).mines).not.toEqual(a.mines);
  });

  it("retries with the derived seed <seed>:n", () => {
    // Find a seed whose first layout needs a guess, then check the retry chain.
    for (let s = 0; s < 50; s++) {
      const b = generateBoard(`retry:${s}`, "expert", 0);
      if (b.attempts === 1) continue;
      const again = placeMines(`retry:${s}:${b.attempts - 1}`, 30, 16, 99, 0);
      expect(again.mines).toEqual(b.mines);
      return;
    }
    throw new Error("expected some expert seed to need a retry");
  });

  it("rejects a first click off the board", () => {
    expect(() => generateBoard("x", "beginner", 81)).toThrow();
    expect(() => generateBoard("x", "beginner", -1)).toThrow();
  });

  for (const d of DIFFICULTIES) {
    it(`${d}: the first click is a safe opening and the board needs no guess`, () => {
      const { width, height, mines } = SIZES[d];
      const times: number[] = [];
      const seeds = d.startsWith("expert") ? 30 : 40;
      for (let s = 0; s < seeds; s++) {
        for (const click of clicks(width, height)) {
          const t0 = performance.now();
          const b = generateBoard(`test:${d}:${s}`, d, click);
          times.push(performance.now() - t0);
          expect(b.width).toBe(width);
          expect(b.height).toBe(height);
          expect(b.mines.filter(Boolean)).toHaveLength(mines);
          expect(b.mineCount).toBe(mines);
          // Safe, and a zero: the 3x3 around the click is clear.
          expect(b.mines[click]).toBe(false);
          for (const n of neighbors(width, height, click)) expect(b.mines[n]).toBe(false);
          expect(adjacentCounts(b)[click]).toBe(0);
          expect(newGame(b).revealed.filter(Boolean).length).toBeGreaterThan(1);
          // The solver clears it from the first click by logic alone.
          const r = solveLayout(b, click);
          expect(r.solved).toBe(true);
          expect(r.revealed.every((open, i) => open !== b.mines[i])).toBe(true);
        }
      }
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(1);
      console.log(
        `[minesweeper timing] ${d}: avg ${avg.toFixed(1)} ms, p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(1)} ms (n=${times.length})`,
      );
      expect(avg).toBeLessThan(1500);
    }, 60_000);
  }
});

describe("dailyBoard", () => {
  it("opens at the centre and is the same for everyone", () => {
    for (const d of DIFFICULTIES) {
      const b = dailyBoard("2026-10-24", d);
      expect(b.firstClick).toBe(centerCell(d));
      expect(dailyBoard("2026-10-24", d)).toEqual(b);
      expect(solveLayout(b, b.firstClick).solved).toBe(true);
    }
    expect(dailyBoard("2026-10-25", "beginner").mines).not.toEqual(dailyBoard("2026-10-24", "beginner").mines);
  });

  it("the portrait expert board is the day's expert board stood upright", () => {
    const wide = dailyBoard("2026-10-24", "expert");
    const tall = dailyBoard("2026-10-24", "expert-mobile");
    expect(tall).toMatchObject({ width: 16, height: 30, difficulty: "expert-mobile" });
    for (let r = 0; r < 16; r++) for (let c = 0; c < 30; c++) expect(tall.mines[c * 16 + r]).toBe(wide.mines[r * 30 + c]);
    expect(transposeBoard(tall, "expert")).toEqual(wide);
  });
});
