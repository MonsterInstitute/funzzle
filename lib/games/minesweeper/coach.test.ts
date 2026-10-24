import { describe, expect, it } from "vitest";
import { DIFFICULTIES, newGame, reveal, toggleFlag, type GameState } from "./board";
import { TECHNIQUES, type Technique } from "./solver";
import { centerCell, generateBoard } from "./generate";
import { hint } from "./coach";
import { at, position } from "./testkit";

describe("hint", () => {
  it("explains a single-safe in plain words", () => {
    const s = position([".F#", "..."]);
    const h = hint(s)!;
    expect(h.technique).toBe("single-safe");
    expect(h.title).toBe("Single safe");
    expect(h.direction).toBe("Look at the 1 at row 2, column 2.");
    expect(h.specific).toBe(
      "The 1 at row 2, column 2 already touches a flag, so every other hidden cell around it is safe.",
    );
    expect(h.answer).toEqual({ cell: 2, kind: "safe" });
    expect(h.answerText).toBe("Row 1, column 3 is safe: open it.");
    expect(h.cells).toEqual([at(s, 1, 1), 2]);
  });

  it("explains a single-flag", () => {
    const h = hint(position([".*#", "..."]))!;
    expect(h.technique).toBe("single-flag");
    expect(h.specific).toBe("The 1 at row 1, column 1 has exactly 1 hidden cell around it, so that cell is a mine.");
    expect(h.answer).toEqual({ cell: 1, kind: "mine" });
    expect(h.answerText).toBe("Row 1, column 2 is a mine: flag it.");
  });

  it("explains a 1-1 pattern", () => {
    const h = hint(position(["*##*", "...."]))!;
    expect(h.technique).toBe("1-1 pattern");
    expect(h.direction).toBe("Compare the 1 at row 2, column 2 with the 1 at row 2, column 1.");
    expect(h.specific).toBe(
      "Every hidden cell around the 1 at row 2, column 1 also touches the 1 at row 2, column 2. The 1 at row 2, column 1 needs 1 mine among them, which is all the 1 at row 2, column 2 needs too. So every other hidden cell around the 1 at row 2, column 2 is safe.",
    );
    expect(h.answer).toEqual({ cell: 2, kind: "safe" });
  });

  it("flags a wrong flag before anything else", () => {
    const s = position(["x.#", "*.."]);
    const h = hint(s)!;
    expect(h.technique).toBe("mistake");
    expect(h.mistakeCell).toBe(0);
    expect(h.direction).toBe("One of your flags isn't on a mine. Check row 1.");
    expect(h.specific).toBe("The flag at row 1, column 1 is wrong.");
    expect(h.answer).toEqual({ cell: 0, kind: "safe" });
  });

  it("returns null once the game is over", () => {
    expect(hint({ ...position([".F#", "..."]), status: "lost" })).toBeNull();
  });

  it("every answer is right on the real layout, all the way to a win", () => {
    const seen = new Set<Technique>();
    const check = (s: GameState) => {
      for (let n = 0; n < 2000 && s.status === "playing"; n++) {
        const h = hint(s)!;
        expect(h).not.toBeNull();
        expect(h.technique).not.toBe("tough-spot");
        expect(h.technique).not.toBe("mistake");
        seen.add(h.technique as Technique);
        for (const text of [h.title, h.direction, h.specific, h.answerText]) {
          expect(text.trim().length).toBeGreaterThan(0);
          expect(text).not.toMatch(/undefined|NaN|\s-\d|\b0 mines? more/);
        }
        const { cell, kind } = h.answer;
        expect(s.mines[cell]).toBe(kind === "mine");
        for (const c of h.deduction!.safe) expect(s.mines[c]).toBe(false);
        for (const c of h.deduction!.mines) expect(s.mines[c]).toBe(true);
        s = kind === "safe" ? reveal(s, cell) : toggleFlag(s, cell);
      }
      expect(s.status).toBe("won");
    };
    for (const d of DIFFICULTIES) {
      for (let k = 0; k < (d === "beginner" ? 30 : 8); k++) check(newGame(generateBoard(`coach:${k}`, d, centerCell(d))));
    }
    expect([...seen].sort()).toEqual([...TECHNIQUES].sort());
  }, 60_000);

  it("catches a wrong flag in the middle of a game, then carries on", () => {
    let s = newGame(generateBoard("coach:mistake", "intermediate", 0));
    const safeHidden = s.mines.findIndex((m, i) => !m && !s.revealed[i]);
    s = toggleFlag(s, safeHidden);
    const h = hint(s)!;
    expect(h.technique).toBe("mistake");
    expect(h.mistakeCell).toBe(safeHidden);
    s = toggleFlag(s, safeHidden);
    expect(hint(s)!.technique).not.toBe("mistake");
  });
});
