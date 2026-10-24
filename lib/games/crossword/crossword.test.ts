import { describe, expect, it } from "vitest";
import { BANK } from "./bank";
import { crosswordHint } from "./coach";
import { bankIndexFor, fallbackDailyCrossword } from "./daily";
import { cellNumbers, entriesOf, entryText, gridProblems } from "./grid";
import { clueProblems, crosswordProblems, stemOf } from "./puzzle";
import { TEMPLATES } from "./templates";

describe("grid rules", () => {
  it("numbers entries American-style", () => {
    const g = ["...#", "....", "....", "#..."].join("");
    const ids = entriesOf(g).map((e) => e.id);
    expect(ids).toEqual(["1A", "4A", "6A", "7A", "1D", "2D", "3D", "5D"]);
    expect(cellNumbers(g).slice(0, 8)).toEqual([1, 2, 3, 0, 4, 0, 0, 5]);
  });

  it("rejects asymmetric grids, short entries, unchecked squares and islands", () => {
    expect(gridProblems(["#....", ".....", ".....", ".....", "....."].join("")).join()).toMatch(/symmetric/);
    expect(gridProblems(["..#..", ".....", ".....", ".....", "..#.."].join("")).join()).toMatch(/2-letter/);
    expect(gridProblems([".....", ".....", "#####", ".....", "....."].join("")).join()).toMatch(/connected/);
    expect(gridProblems(".".repeat(25))).toEqual([]);
  });

  it("every template is symmetric, fully checked, connected, entries >= 3", () => {
    for (const [size, list] of Object.entries(TEMPLATES)) {
      for (const t of list) {
        expect(t).toHaveLength(Number(size) ** 2);
        expect(gridProblems(t)).toEqual([]);
        for (const e of entriesOf(t)) expect(e.cells.length).toBeGreaterThanOrEqual(3);
      }
    }
    expect(TEMPLATES[11].length).toBeGreaterThanOrEqual(6);
    expect(TEMPLATES[13].length).toBeGreaterThanOrEqual(6);
  });
});

describe("fallback bank", () => {
  it("has at least 10 complete, valid 11×11 crosswords", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(10);
    for (const p of BANK) {
      expect(p.size).toBe(11);
      expect(crosswordProblems(p), p.title).toEqual([]);
    }
  });

  it("clues every entry exactly once and never gives the answer away", () => {
    for (const p of BANK) {
      const entries = entriesOf(p.grid);
      expect(Object.keys(p.clues).sort()).toEqual(entries.map((e) => e.id).sort());
      for (const e of entries) {
        const answer = entryText(p.grid, e);
        expect(p.clues[e.id].toLowerCase()).not.toContain(answer);
        expect(clueProblems(answer, p.clues[e.id]), `${p.title} ${e.id}`).toEqual([]);
      }
    }
  });

  it("picks a different bank puzzle on neighboring days, deterministically", () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    const picks = days.map((d) => bankIndexFor(d));
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
    expect(fallbackDailyCrossword("2026-10-24")).toBe(fallbackDailyCrossword("2026-10-24"));
  });
});

describe("clue validation", () => {
  it("catches the answer, its stem and junk", () => {
    expect(clueProblems("stars", "Shining star")).not.toEqual([]);
    expect(clueProblems("eluding", "Trying to elude")).not.toEqual([]);
    expect(clueProblems("ace", "Spaced out")).not.toEqual([]);
    expect(clueProblems("ace", "<b>Top card</b>")).not.toEqual([]);
    expect(clueProblems("ace", "Top card.")).not.toEqual([]);
    expect(clueProblems("ace", "Top card")).toEqual([]);
    expect(clueProblems("stars", "Twinklers in the night sky")).toEqual([]);
    expect(stemOf("eluding")).toBe("elud");
  });
});

describe("coach", () => {
  const p = BANK[0];
  const values = [...p.grid].map(() => "");

  it("starts with the easiest open clue, then a pattern with a crossing, then one letter", () => {
    const h = crosswordHint(p, values)!;
    expect(h.entry.cells.length).toBe(Math.min(...entriesOf(p.grid).map((e) => e.cells.length)));
    expect(h.nudge).toContain(h.clue);
    expect(h.pattern).toBe(h.entry.cells.map(() => "_").join(" "));
    expect(h.entry.cells).toContain(h.cell);
    expect(h.letter).toBe(p.grid[h.cell]);
    if (h.crossing) expect(h.detail).toContain(h.crossing.clue);
  });

  it("prefers the entry closest to done and skips solved ones", () => {
    const e = entriesOf(p.grid).find((x) => x.cells.length >= 5)!;
    const v = values.slice();
    e.cells.slice(0, -1).forEach((i) => (v[i] = p.grid[i]));
    const h = crosswordHint(p, v)!;
    expect(h.entry.id).toBe(e.id);
    expect(h.cell).toBe(e.cells.at(-1));
    expect(h.pattern.endsWith("_")).toBe(true);
    expect(crosswordHint(p, [...p.grid])).toBeNull();
  });
});
