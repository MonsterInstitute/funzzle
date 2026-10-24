import { describe, expect, it } from "vitest";
import { autoplay, bestPlacement, boardValue } from "./coach";
import { dailyBlock } from "./index";
import { canPlace, isOver, newGame, place, SIZE, type State } from "./engine";

function withTray(board: number[], tray: (string | null)[]): State {
  return { ...newGame("coach", ["1", "1", "1"]), board, tray, next: 3 };
}

describe("block coach", () => {
  it("takes the clearing placement when there is one", () => {
    const b = new Array(64).fill(0);
    for (let c = 0; c < 5; c++) b[2 * SIZE + c] = 1; // row 2 needs columns 5–7
    const h = bestPlacement(withTray(b, ["3h", null, null]))!;
    expect(h.pieceId).toBe("3h");
    expect(h.row).toBe(2);
    expect(h.col).toBe(5);
    expect(h.lines).toBe(1);
    expect(h.reason).toBe("clear");
    expect(h.text).toContain("3-bar");
    expect(h.why.length).toBeGreaterThan(20);
  });

  it("prefers a double clear and says why", () => {
    const b = new Array(64).fill(0);
    for (let c = 0; c < 6; c++) {
      b[0 * SIZE + c] = 1;
      b[1 * SIZE + c] = 1;
    }
    const h = bestPlacement(withTray(b, ["o2", "1", null]))!;
    expect(h.pieceId).toBe("o2");
    expect([h.row, h.col]).toEqual([0, 6]);
    expect(h.reason).toBe("multi");
    expect(h.why).toContain("2 lines");
  });

  it("keeps the board open: fewer isolated holes is better", () => {
    const open = new Array(64).fill(0);
    const holey = open.slice();
    holey[1] = holey[8] = 1; // cell 0 is now an isolated hole
    expect(boardValue(open)).toBeGreaterThan(boardValue(holey));
  });

  it("returns null when nothing fits, and a legal move otherwise", () => {
    const full = new Array(64).fill(1);
    expect(bestPlacement(withTray(full, ["o2", null, null]))).toBeNull();
    const s = newGame("legal");
    const h = bestPlacement(s)!;
    expect(canPlace(s.board, s.tray[h.slot]!, h.row, h.col)).toBe(true);
  });

  it("decides quickly and plays the daily well (calibration)", () => {
    const dates = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    const scores: number[] = [];
    let decisions = 0;
    let worst = 0;
    const t0 = performance.now();
    for (const date of dates) {
      const d = dailyBlock(date);
      let s = newGame(d.seed, d.pieces);
      while (!isOver(s)) {
        const t = performance.now();
        const h = bestPlacement(s);
        worst = Math.max(worst, performance.now() - t);
        decisions++;
        if (!h) break;
        s = place(s, h.slot, h.row, h.col).state;
      }
      scores.push(s.score);
    }
    const avgMs = (performance.now() - t0) / decisions;
    console.log(`block coach: daily scores ${scores.join(", ")}; ${avgMs.toFixed(1)} ms/decision avg, ${worst.toFixed(0)} ms worst`);
    expect(Math.min(...scores)).toBeGreaterThan(300);
    expect(avgMs).toBeLessThan(150);
  }, 120_000);

  it("autoplay survives a long practice game", () => {
    const s = autoplay(newGame("practice-long"), place, isOver, 150);
    console.log(`block coach: practice 150 pieces → ${s.score} points, ${s.lines} lines, best combo ${s.bestCombo}`);
    expect(s.placed).toBeGreaterThan(60);
  }, 120_000);
});
