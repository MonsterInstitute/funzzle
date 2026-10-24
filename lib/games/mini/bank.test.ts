import { describe, expect, it } from "vitest";
import { wordProblems } from "./fill";
import { MINI_BANK, bankMiniFor, bankMiniForSeed } from "./bank";
import { clueProblems, clueSetProblems, stemOf } from "./clues";
import { layoutOf, shapeProblems } from "./grid";
import { hintLadder, keyMove } from "./coach";

describe("MINI_BANK", () => {
  it("has at least 30 puzzles with unique ids and grids", () => {
    expect(MINI_BANK.length).toBeGreaterThanOrEqual(30);
    expect(new Set(MINI_BANK.map((b) => b.id)).size).toBe(MINI_BANK.length);
    expect(new Set(MINI_BANK.map((b) => b.rows.join("/"))).size).toBe(MINI_BANK.length);
  });

  for (const b of MINI_BANK) {
    it(`${b.id} is a valid, fully clued grid`, () => {
      expect(b.size).toBe(b.rows.length);
      expect(b.rows.every((r) => /^[A-Z#]+$/.test(r))).toBe(true);
      expect(shapeProblems(b.rows)).toEqual([]);
      expect(wordProblems(b)).toEqual([]);
      expect(clueSetProblems(b)).toEqual([]);
    });
  }

  it("falls back deterministically by date, without repeating on consecutive days", () => {
    expect(bankMiniFor("2026-10-24").id).toBe(bankMiniFor("2026-10-24").id);
    const ids = Array.from({ length: MINI_BANK.length }, (_, i) => bankMiniFor(new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)).id);
    expect(new Set(ids).size).toBe(MINI_BANK.length);
  });

  it("practice picks are a pure function of the seed and spread over the bank", () => {
    expect(bankMiniForSeed("mini-practice:x").id).toBe(bankMiniForSeed("mini-practice:x").id);
    const ids = new Set(Array.from({ length: 200 }, (_, i) => bankMiniForSeed(`p:${i}`).id));
    expect(ids.size).toBeGreaterThan(MINI_BANK.length * 0.8);
  });
});

describe("clue rules", () => {
  it("rejects clues that give the answer away", () => {
    expect(clueProblems("TEEN", "Sixteen-year-old")).toEqual([]); // short answers only match whole words
    expect(clueProblems("TEEN", "A teen, e.g.")).not.toEqual([]);
    expect(clueProblems("ELVES", "Santa's elf crew")).not.toEqual([]);
    expect(clueProblems("SHAPE", "Shaped like a star")).not.toEqual([]);
    expect(clueProblems("TEST", "Testy remark")).not.toEqual([]);
    expect(clueProblems("ICECREAM", "Ice cream")).not.toEqual([]);
    expect(clueProblems("TEN", "Often")).toEqual([]);
    expect(clueProblems("TEN", "")).not.toEqual([]);
    expect(clueProblems("TEN", "x".repeat(61))).not.toEqual([]);
    expect(clueProblems("TEN", 5)).toEqual(["missing clue"]);
    expect(stemOf("elves")).toBe("elf");
    expect(stemOf("berries")).toBe("berry");
  });

  it("flags missing and extra clues", () => {
    const b = MINI_BANK[0];
    const { "1A": _gone, ...rest } = b.clues;
    void _gone;
    expect(clueSetProblems({ rows: b.rows, clues: rest })).toEqual(["1A AFAR: missing clue"]);
    expect(clueSetProblems({ rows: b.rows, clues: { ...b.clues, "99A": "x" } })).toEqual(["99A: no such entry"]);
  });
});

describe("coach", () => {
  const b = MINI_BANK[0];
  const L = layoutOf(b.rows);
  const empty = L.solution.map(() => "");

  it("points at a short clue on an empty grid, then reveals a letter of it", () => {
    const h = hintLadder(L, empty, b.clues)!;
    expect(L.entries[h.entry].cells.length).toBe(3);
    expect(L.entries[h.entry].cells).toContain(h.cell);
    expect(h.direction).toContain(b.clues[L.entries[h.entry].id]);
    expect(h.answer).toContain(L.entries[h.entry].answer);
  });

  it("prefers the clue the crossings have nearly filled, and fixes wrong letters first", () => {
    const values = empty.slice();
    const scout = L.entries.find((e) => e.answer === "SCOUT")!;
    scout.cells.slice(0, 4).forEach((i) => (values[i] = L.solution[i]));
    const h = hintLadder(L, values, b.clues)!;
    expect(L.entries[h.entry].answer).toBe("SCOUT");
    expect(h.cell).toBe(scout.cells[4]);
    values[scout.cells[0]] = "Z";
    const h2 = hintLadder(L, values, b.clues)!;
    expect(h2.cell).toBe(L.entries[h2.entry].cells.find((i) => values[i] && values[i] !== L.solution[i]));
  });

  it("returns null when solved, and finds the key move", () => {
    expect(hintLadder(L, L.solution.slice(), b.clues)).toBeNull();
    const placedAt = L.solution.map((s, i) => (s ? 1000 + i * 100 : 0));
    const revealed = L.solution.map(() => false);
    const k = keyMove(L, placedAt, revealed)!;
    expect(L.entries[k.entry].cells.length).toBe(5);
  });
});
