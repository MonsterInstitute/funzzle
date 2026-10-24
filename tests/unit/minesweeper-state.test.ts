import { describe, expect, it } from "vitest";
import { centerCell, dailyBoard, generateBoard, hint, transposeBoard, type GameState } from "@/lib/games/minesweeper";
import { at, position } from "@/lib/games/minesweeper/testkit";
import { isLevel, levelOf, practiceBoard } from "@/components/minesweeper/boards";
import { cellLabel, cellView, initialState, moveCursor, reducer, safeLeft, type PlayState } from "@/components/minesweeper/state";

const play = (game: GameState): PlayState => ({ game, hints: 0, explosions: 0, lastFlag: null, coached: [], coachedTechniques: [] });
// Mine top-left; the 1 in the middle touches it.
const small = () => play(position(["*#.", "#..", "..."]));

describe("minesweeper play state", () => {
  it("a tap opens a hidden cell, or flags it in flag mode", () => {
    const s = small();
    const opened = reducer(s, { type: "activate", cell: at(s.game, 0, 1), flagMode: false });
    expect(opened.game.revealed[at(s.game, 0, 1)]).toBe(true);
    expect(opened.game.status).toBe("playing");
    const flagged = reducer(s, { type: "activate", cell: at(s.game, 0, 0), flagMode: true });
    expect(flagged.game.flagged[at(s.game, 0, 0)]).toBe(true);
    expect(flagged.game.revealed[at(s.game, 0, 0)]).toBe(false);
    expect(flagged.lastFlag).toBe(at(s.game, 0, 0));
  });

  it("a tap on a number chords once its flags are placed", () => {
    let s = small();
    const one = at(s.game, 1, 1);
    // Not enough flags yet: nothing happens.
    expect(reducer(s, { type: "activate", cell: one, flagMode: false })).toBe(s);
    s = reducer(s, { type: "flag", cell: at(s.game, 0, 0) });
    s = reducer(s, { type: "activate", cell: one, flagMode: false });
    expect(s.game.status).toBe("won");
    expect(safeLeft(s.game)).toBe(0);
  });

  it("a mine loses, counts once, and a second chance rewinds it", () => {
    const s = reducer(small(), { type: "activate", cell: 0, flagMode: false });
    expect(s.game.status).toBe("lost");
    expect(s.explosions).toBe(1);
    expect(cellView(s.game, 0)).toEqual({ kind: "mine", exploded: true });
    // Further taps on a lost board do nothing.
    expect(reducer(s, { type: "activate", cell: 1, flagMode: false })).toBe(s);
    const again = reducer(s, { type: "second-chance" });
    expect(again.game.status).toBe("playing");
    expect(again.game.revealed[0]).toBe(false);
    expect(again.explosions).toBe(1);
    expect(reducer(again, { type: "second-chance" })).toBe(again);
  });

  it("a wrong flag shows after a loss, with the other mines", () => {
    let s = play(position(["*#*", "x..", "..."]));
    s = reducer(s, { type: "activate", cell: 0, flagMode: false });
    expect(cellView(s.game, at(s.game, 1, 0))).toEqual({ kind: "flag", wrong: true });
    expect(cellView(s.game, 2)).toEqual({ kind: "mine", exploded: false });
    expect(cellLabel(s.game, at(s.game, 1, 0))).toBe("Row 2, column 1: flagged, not a mine");
  });

  it("undo takes back only the last flag", () => {
    let s = play(position(["*#*", "#..", "..."]));
    s = reducer(s, { type: "flag", cell: 0 });
    s = reducer(s, { type: "flag", cell: 2 });
    s = reducer(s, { type: "undo-flag" });
    expect(s.game.flagged[2]).toBe(false);
    expect(s.game.flagged[0]).toBe(true);
    expect(s.lastFlag).toBeNull();
    const again = reducer(s, { type: "undo-flag" });
    expect(again.game).toBe(s.game);
    // Removing a flag can be undone too.
    s = reducer(s, { type: "flag", cell: 0 });
    expect(reducer(s, { type: "undo-flag" }).game.flagged[0]).toBe(true);
  });

  it("applies the coach's answers: open, flag, or take a wrong flag off", () => {
    let s = play(position(["*#.", "x..", "..."]));
    s = reducer(s, { type: "coach-apply", cell: at(s.game, 1, 0), kind: "safe", mistake: true });
    expect(s.game.flagged[at(s.game, 1, 0)]).toBe(false);
    expect(s.game.revealed[at(s.game, 1, 0)]).toBe(false);
    s = reducer(s, { type: "coach-apply", cell: 0, kind: "mine", mistake: false });
    expect(s.game.flagged[0]).toBe(true);
    s = reducer(s, { type: "coach-apply", cell: 1, kind: "safe", mistake: false });
    expect(s.game.revealed[1]).toBe(true);
    expect(s.coached).toEqual([at(s.game, 1, 0), 0, 1]);
  });

  it("counts hints and remembers which techniques the coach explained", () => {
    let s = small();
    s = reducer(s, { type: "hint-used", technique: "single-flag" });
    s = reducer(s, { type: "hint-used", technique: "single-flag" });
    s = reducer(s, { type: "hint-used", technique: "subset" });
    expect(s.hints).toBe(3);
    expect(s.coachedTechniques).toEqual(["single-flag", "subset"]);
  });

  it("labels cells for screen readers", () => {
    const s = small();
    expect(cellLabel(s.game, 0)).toBe("Row 1, column 1: hidden");
    expect(cellLabel(s.game, at(s.game, 1, 1))).toBe("Row 2, column 2: 1");
    expect(cellLabel(s.game, at(s.game, 2, 2))).toBe("Row 3, column 3: empty");
    const flagged = reducer(s, { type: "flag", cell: 0 });
    expect(cellLabel(flagged.game, 0)).toBe("Row 1, column 1: flagged");
    expect(cellLabel(flagged.game, at(s.game, 1, 1))).toBe("Row 2, column 2: 1, 1 flagged around");
  });

  it("moves the keyboard cursor and stops at the edges", () => {
    expect(moveCursor(9, 9, 0, "ArrowLeft")).toBe(0);
    expect(moveCursor(9, 9, 0, "ArrowUp")).toBe(0);
    expect(moveCursor(9, 9, 0, "ArrowRight")).toBe(1);
    expect(moveCursor(9, 9, 0, "ArrowDown")).toBe(9);
    expect(moveCursor(9, 9, 8, "ArrowRight")).toBe(8);
    expect(moveCursor(9, 9, 80, "ArrowDown")).toBe(80);
  });

  it("following the coach's answers clears the daily board without a mine", () => {
    let s = initialState(dailyBoard("2026-10-24", "intermediate"));
    for (let step = 0; step < 400 && s.game.status === "playing"; step++) {
      const h = hint(s.game)!;
      expect(h.technique).not.toBe("tough-spot");
      s = reducer(s, { type: "coach-apply", cell: h.answer.cell, kind: h.answer.kind, mistake: h.mistakeCell !== undefined });
    }
    expect(s.game.status).toBe("won");
    expect(s.explosions).toBe(0);
  });
});

describe("minesweeper boards", () => {
  it("practice boards are reproducible from the seed and open at the center", () => {
    const a = practiceBoard("minesweeper-practice:x", "beginner", false);
    const b = practiceBoard("minesweeper-practice:x", "beginner", true);
    expect(a.mines).toEqual(b.mines);
    expect(a.firstClick).toBe(centerCell("beginner"));
    expect(initialState(a).game.revealed[a.firstClick]).toBe(true);
  });

  it("expert stands upright on a portrait phone: the same board turned", () => {
    const wide = practiceBoard("minesweeper-practice:y", "expert", false);
    const tall = practiceBoard("minesweeper-practice:y", "expert", true);
    expect([wide.width, wide.height]).toEqual([30, 16]);
    expect([tall.width, tall.height, tall.difficulty]).toEqual([16, 30, "expert-mobile"]);
    expect(tall.mines).toEqual(transposeBoard(generateBoard("minesweeper-practice:y", "expert", centerCell("expert")), "expert-mobile").mines);
    expect(tall.firstClick).toBe(centerCell("expert-mobile"));
    expect(levelOf(tall.difficulty)).toBe("expert");
  });

  it("only accepts real levels from the URL", () => {
    expect(isLevel("beginner")).toBe(true);
    expect(isLevel("expert-mobile")).toBe(false);
    expect(isLevel(null)).toBe(false);
  });
});
