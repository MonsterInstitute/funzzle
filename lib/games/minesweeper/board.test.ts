import { describe, expect, it } from "vitest";
import { adjacentCounts, chord, minesLeft, neighbors, newGame, reveal, toggleFlag, undoExplosion } from "./board";
import { at, position } from "./testkit";

/** A 5x5 board with mines in two corners, nothing opened. */
const fresh = () => position(["*####", "#####", "#####", "#####", "####*"]);

describe("board rules", () => {
  it("counts neighbors and adjacent mines", () => {
    expect(neighbors(5, 5, 0)).toEqual([1, 5, 6]);
    expect(neighbors(5, 5, 12)).toHaveLength(8);
    const counts = adjacentCounts(fresh());
    expect(counts[0]).toBe(-1);
    expect(counts[1]).toBe(1);
    expect(counts[6]).toBe(1);
    expect(counts[12]).toBe(0);
  });

  it("flood-fills through zeros and stops at numbers", () => {
    const s = reveal(fresh(), at(fresh(), 2, 2));
    // Everything but the two mines opens: every safe cell is a zero or borders one.
    expect(s.revealed.filter(Boolean)).toHaveLength(23);
    expect(s.revealed[0]).toBe(false);
    expect(s.status).toBe("won");
    expect(s.moves).toBe(1);
    // A win flags the remaining mines.
    expect(s.flagged[0] && s.flagged[24]).toBe(true);
  });

  it("never floods into a flagged cell", () => {
    let s = toggleFlag(fresh(), at(fresh(), 2, 4));
    s = reveal(s, at(s, 2, 1));
    expect(s.revealed[at(s, 2, 4)]).toBe(false);
    expect(s.status).toBe("playing");
    // Revealing a flagged cell does nothing.
    expect(reveal(s, at(s, 2, 4))).toBe(s);
  });

  it("revealing a number opens just that cell", () => {
    const s = reveal(fresh(), 1);
    expect(s.revealed.filter(Boolean)).toEqual([true]);
  });

  it("loses on a mine and records the explosion", () => {
    const before = reveal(fresh(), 1);
    const s = reveal(before, 0);
    expect(s.status).toBe("lost");
    expect(s.exploded).toBe(0);
    expect(s.beforeExplosion).toEqual({ revealed: before.revealed, flagged: before.flagged, moves: before.moves });
    // Finished games ignore further input.
    expect(reveal(s, 12)).toBe(s);
    expect(toggleFlag(s, 3)).toBe(s);
  });

  it("toggles flags only on hidden cells", () => {
    const s = reveal(fresh(), 1);
    expect(toggleFlag(s, 1)).toBe(s);
    const f = toggleFlag(s, 0);
    expect(f.flagged[0]).toBe(true);
    expect(minesLeft(f)).toBe(1);
    expect(f.moves).toBe(2);
    expect(toggleFlag(f, 0).flagged[0]).toBe(false);
  });

  it("chords when the flags match the number", () => {
    let s = position(["*##", "###", "###"]);
    s = reveal(s, 4); // the centre is a 1
    expect(chord(s, 4)).toBe(s); // no flag yet
    s = toggleFlag(s, 0);
    const c = chord(s, 4);
    expect(c.status).toBe("won");
    expect(c.revealed.filter(Boolean)).toHaveLength(8);
  });

  it("chording on a wrong flag loses", () => {
    let s = position(["*##", "###", "###"]);
    s = reveal(s, 4);
    s = toggleFlag(s, 2);
    const c = chord(s, 4);
    expect(c.status).toBe("lost");
    expect(c.exploded).toBe(0);
  });

  it("wins once every safe cell is open", () => {
    let s = position(["*#", "##"]);
    s = reveal(reveal(reveal(s, 1), 2), 3);
    expect(s.status).toBe("won");
  });

  it("newGame opens the first click", () => {
    const b = { ...fresh(), firstClick: 12 };
    const s = newGame(b);
    expect(s.revealed[12]).toBe(true);
    expect(s.moves).toBe(1);
  });

  it("state survives a JSON round trip", () => {
    const s = toggleFlag(reveal(fresh(), 1), 0);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("undoExplosion", () => {
  it("rewinds to just before the fatal click", () => {
    const before = toggleFlag(reveal(fresh(), 1), 24);
    const lost = reveal(before, 0);
    const back = undoExplosion(lost);
    expect(back.status).toBe("playing");
    expect(back.exploded).toBeNull();
    expect(back.beforeExplosion).toBeNull();
    expect(back.revealed).toEqual(before.revealed);
    expect(back.flagged).toEqual(before.flagged);
    expect(back.moves).toBe(before.moves);
    // The game carries on normally.
    expect(reveal(back, 12).status).toBe("won");
  });

  it("rewinds a losing chord too", () => {
    let s = position(["*##", "###", "###"]);
    s = toggleFlag(reveal(s, 4), 2);
    const back = undoExplosion(chord(s, 4));
    expect(back.revealed).toEqual(s.revealed);
    expect(back.flagged).toEqual(s.flagged);
  });

  it("leaves other states alone", () => {
    const s = reveal(fresh(), 1);
    expect(undoExplosion(s)).toBe(s);
  });
});
