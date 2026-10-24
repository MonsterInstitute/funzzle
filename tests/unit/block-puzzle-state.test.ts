import { describe, expect, it } from "vitest";
import { centeredAnchor, firstFit, ghostCells, liftedPosition, nudge, previewClears, skillsEarned, snapAnchor, TOUCH_LIFT_CELLS, whereText } from "@/components/block/state";
import { DAILY_PIECES, newGame, SIZE, validSequence, type State } from "@/lib/games/block";

const board = { left: 100, top: 200, cell: 40 };

describe("block puzzle drag helpers", () => {
  it("lifts a touch-dragged piece above the finger; a mouse holds it by the middle", () => {
    const touch = liftedPosition("o2", 300, 500, 40, true);
    expect(touch.left).toBe(300 - 40);
    expect(touch.top).toBe(500 - 80 - TOUCH_LIFT_CELLS * 40);
    // The whole piece is above the finger.
    expect(touch.top + 80).toBeLessThan(500);
    expect(liftedPosition("o2", 300, 500, 40, false)).toEqual({ left: 260, top: 460 });
  });

  it("snaps to the nearest cell and refuses spots off the board", () => {
    expect(snapAnchor("o2", 100 + 2 * 40 + 15, 200 + 3 * 40 - 12, board)).toEqual({ row: 3, col: 2 });
    expect(snapAnchor("o2", 100 + 6.4 * 40, 200, board)).toEqual({ row: 0, col: 6 });
    expect(snapAnchor("o2", 100 + 6.6 * 40, 200, board)).toBeNull();
    expect(snapAnchor("1", 60, 200, board)).toBeNull();
  });

  it("centers a tapped piece and keeps keyboard moves on the board", () => {
    expect(centeredAnchor("o3", 4, 4)).toEqual({ row: 3, col: 3 });
    expect(centeredAnchor("o3", 0, 7)).toEqual({ row: 0, col: 5 });
    expect(nudge("5h", { row: 0, col: 3 }, 0, 1)).toEqual({ row: 0, col: 3 });
    expect(nudge("5h", { row: 0, col: 2 }, -1, 1)).toEqual({ row: 0, col: 3 });
  });

  it("previews the lines a ghost would clear", () => {
    const b = new Array(64).fill(0);
    for (let c = 0; c < 6; c++) b[c] = 1;
    expect(previewClears(b, "2h", 0, 6)).toEqual({ rows: [0], cols: [] });
    expect(previewClears(b, "2h", 1, 6)).toEqual({ rows: [], cols: [] });
    expect(previewClears(b, "2h", 0, 5)).toEqual({ rows: [], cols: [] }); // doesn't fit
    expect(ghostCells("2v", 6, 7)).toEqual([6 * SIZE + 7, 7 * SIZE + 7]);
    expect(firstFit(b, "2h")).toEqual({ row: 0, col: 6 });
    expect(whereText("o2", 1, 2)).toBe("rows 2 to 3, columns 3 to 4");
  });
});

describe("block puzzle skills", () => {
  const base = newGame("skills", ["1"]);
  const s = (over: Partial<State>): State => ({ ...base, ...over });
  it("maps a finished game to skill ids", () => {
    expect(skillsEarned(s({}), { daily: true, hints: 0 })).toEqual([]);
    expect(skillsEarned(s({ lines: 5, maxLines: 2, bestCombo: 3, score: 1600, placed: DAILY_PIECES, cleanBoard: true }), { daily: true, hints: 0 })).toEqual([
      "clear-line",
      "double",
      "combo-3",
      "score-1000",
      "full-daily",
      "clean-board",
      "unaided",
    ]);
    // Practice can't earn the daily skill; hints cost "unaided".
    expect(skillsEarned(s({ score: 1600, placed: 200 }), { daily: false, hints: 2 })).toEqual(["score-1000"]);
  });

  it("only plays stored sequences of known pieces", () => {
    expect(validSequence(["1", "o3"])).toBe(true);
    expect(validSequence(undefined)).toBe(false);
    expect(validSequence([])).toBe(false);
    expect(validSequence(["1", "nope"])).toBe(false);
  });
});
