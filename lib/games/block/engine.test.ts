import { describe, expect, it } from "vitest";
import { dailyBlock } from "./index";
import {
  canPlace,
  DAILY_PIECES,
  fitsAnywhere,
  isOver,
  isStuck,
  lineScore,
  newGame,
  pieceAt,
  PIECE_IDS,
  PIECES,
  piecesLeft,
  place,
  placements,
  secondChance,
  sequence,
  sequenceDone,
  SIZE,
  type State,
} from "./engine";

const empty = () => new Array(64).fill(0);
/** A state with this board and tray. */
function withTray(board: number[], tray: (string | null)[], extra: Partial<State> = {}): State {
  return { ...newGame("test", ["1", "1", "1"]), board, tray, next: 3, ...extra };
}

describe("pieces", () => {
  it("every piece is 1–9 cells within its box, no rotations needed", () => {
    for (const id of PIECE_IDS) {
      const p = PIECES[id];
      expect(p.cells.length).toBeGreaterThan(0);
      expect(p.cells.length).toBeLessThanOrEqual(9);
      for (const [r, c] of p.cells) {
        expect(r).toBeLessThan(p.h);
        expect(c).toBeLessThan(p.w);
      }
    }
    expect(PIECES.o3.cells).toHaveLength(9);
    expect(PIECES["5h"].w).toBe(5);
  });

  it("the sequence is a pure function of the seed", () => {
    expect(sequence("a", 20)).toEqual(sequence("a", 20));
    expect(sequence("a", 20)).not.toEqual(sequence("b", 20));
    expect(pieceAt("a", 7)).toBe(sequence("a", 8)[7]);
    expect(dailyBlock("2026-10-24")).toEqual(dailyBlock("2026-10-24"));
    expect(dailyBlock("2026-10-24").pieces).toHaveLength(DAILY_PIECES);
  });

  it("uses a good mix of pieces", () => {
    const seen = new Set(sequence("mix", 600));
    expect(seen.size).toBeGreaterThan(PIECE_IDS.length - 3);
  });
});

describe("placing", () => {
  it("checks bounds and overlaps", () => {
    const b = empty();
    expect(canPlace(b, "5h", 0, 3)).toBe(true);
    expect(canPlace(b, "5h", 0, 4)).toBe(false);
    expect(canPlace(b, "5v", 4, 0)).toBe(false);
    expect(canPlace(b, "1", -1, 0)).toBe(false);
    b[0] = 1;
    expect(canPlace(b, "o2", 0, 0)).toBe(false);
    // The S piece's empty corner may sit on a filled cell.
    expect(canPlace(b, "sa", 0, 0)).toBe(true);
    expect(placements(empty(), "o3")).toHaveLength(36);
  });

  it("scores one point per square and refills the tray after three pieces", () => {
    let s = newGame("deal", ["o2", "1", "3h", "2v", "2h", "1"]);
    expect(s.tray).toEqual(["o2", "1", "3h"]);
    s = place(s, 0, 0, 0).state;
    expect(s.score).toBe(4);
    expect(s.tray).toEqual([null, "1", "3h"]);
    expect(() => place(s, 0, 4, 4)).toThrow();
    expect(() => place(s, 1, 0, 0)).toThrow();
    s = place(s, 1, 7, 7).state;
    s = place(s, 2, 5, 0).state;
    expect(s.tray).toEqual(["2v", "2h", "1"]);
    expect(s.placed).toBe(3);
    expect(piecesLeft(s)).toBe(3);
  });

  it("clears full rows and columns together, with combos", () => {
    const b = empty();
    // Row 0 full except (0,7); column 7 full except (0,7).
    for (let c = 0; c < 7; c++) b[c] = 2;
    for (let r = 1; r < SIZE; r++) b[r * SIZE + 7] = 2;
    const r1 = place(withTray(b, ["1", "1", "4h"]), 0, 0, 7);
    expect(r1.rows).toEqual([0]);
    expect(r1.cols).toEqual([7]);
    expect(r1.linePoints).toBe(lineScore(2));
    expect(r1.points).toBe(1 + 30);
    expect(r1.state.board.every((v) => v === 0)).toBe(true);
    expect(r1.state.cleanBoard).toBe(true);
    expect(r1.state.combo).toBe(1);
    expect(r1.state.maxLines).toBe(2);

    // A second clear in a row adds a combo bonus; a miss resets it.
    const b2 = r1.state.board.slice();
    for (let c = 0; c < 7; c++) b2[3 * SIZE + c] = 3;
    const r2 = place({ ...r1.state, board: b2 }, 1, 3, 7);
    expect(r2.points).toBe(1 + 10 + 10);
    expect(r2.state.combo).toBe(2);
    expect(r2.state.bestCombo).toBe(2);
    const r3 = place(r2.state, 2, 7, 0);
    expect(r3.comboBonus).toBe(0);
    expect(r3.state.combo).toBe(0);
  });

  it("line scores grow with lines cleared at once", () => {
    expect([1, 2, 3, 4].map(lineScore)).toEqual([10, 30, 60, 100]);
  });
});

describe("game over", () => {
  it("is stuck when no piece in hand fits", () => {
    const b = new Array(64).fill(1);
    b[0] = 0; // one hole
    const s = withTray(b, ["o2", "3h", null]);
    expect(isStuck(s)).toBe(true);
    expect(isOver(s)).toBe(true);
    expect(isStuck(withTray(b, ["o2", "1", null]))).toBe(false);
    expect(fitsAnywhere(b, "1")).toBe(true);
  });

  it("a daily ends when its sequence is placed", () => {
    let s = newGame("end", ["1", "1", "1"]);
    s = place(s, 0, 0, 0).state;
    s = place(s, 1, 0, 2).state;
    expect(sequenceDone(s)).toBe(false);
    s = place(s, 2, 0, 4).state;
    expect(sequenceDone(s)).toBe(true);
    expect(isStuck(s)).toBe(false);
    expect(isOver(s)).toBe(true);
    expect(piecesLeft(s)).toBe(0);
  });

  it("practice games never run out of pieces", () => {
    let s = newGame("endless");
    for (let i = 0; i < 3; i++) {
      const [r, c] = placements(s.board, s.tray[i]!)[0];
      s = place(s, i, r, c).state;
    }
    expect(s.next).toBe(6);
    expect(piecesLeft(s)).toBeNull();
    expect(s.tray.every(Boolean)).toBe(true);
  });

  it("second chance clears three occupied rows, once, the same way every time", () => {
    const b = new Array(64).fill(1);
    const s = withTray(b, ["o3", null, null]);
    const a = secondChance(s);
    expect(a.board.filter((v) => !v)).toHaveLength(24);
    expect(secondChance(s).board).toEqual(a.board);
    expect(a.secondChanceUsed).toBe(true);
    expect(secondChance(a)).toBe(a);
  });
});
