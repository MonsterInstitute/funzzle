import { describe, expect, it } from "vitest";
import { canTap, initialState, isSolved, pathPositions, reducer, type Action, type BoxState } from "@/components/letterbox/state";
import { generateLetterBox } from "@/lib/games/letterbox/generate";
import { boxHint } from "@/lib/games/letterbox";

const puzzle = generateLetterBox("letter-box:2026-10-24");
const run = (s: BoxState, actions: Action[]) => actions.reduce(reducer, s);
const taps = (word: string): Action[] => word.split("").map((letter) => ({ type: "tap", letter }) as Action);

describe("letter box reducer", () => {
  const [a, b] = puzzle.solution;

  it("chains words from the last letter and solves with every letter used", () => {
    let s = run(initialState(puzzle), [...taps(a), { type: "submit", at: 1000 }]);
    expect(s.words).toEqual([a]);
    expect(s.current).toBe(a.slice(-1));
    expect(s.message?.tone).toBe("good");
    // The carried first letter is already there.
    s = run(s, [...taps(b.slice(1)), { type: "submit", at: 2000 }]);
    expect(s.words).toEqual([a, b]);
    expect(isSolved(s)).toBe(true);
    expect(s.playedAt).toEqual([1000, 2000]);
    // Solved boards ignore input.
    expect(reducer(s, { type: "tap", letter: a[0] })).toBe(s);
  });

  it("won't tap two letters from the same side in a row", () => {
    const s = run(initialState(puzzle), taps(puzzle.sides[0][0]));
    expect(canTap(s, puzzle.sides[0][1])).toBe(false);
    expect(canTap(s, puzzle.sides[1][0])).toBe(true);
    expect(reducer(s, { type: "tap", letter: puzzle.sides[0][1] }).current).toBe(puzzle.sides[0][0]);
    expect(canTap(s, "#")).toBe(false);
  });

  it("rejects unknown words as mistakes and keeps the input", () => {
    const junk = puzzle.sides[0][0] + puzzle.sides[1][0] + puzzle.sides[0][0] + puzzle.sides[1][0];
    const s = run(initialState(puzzle), [...taps(junk), { type: "submit", at: 1 }]);
    if (!puzzle.words.includes(junk)) {
      expect(s.mistakes).toBe(1);
      expect(s.current).toBe(junk);
      expect(s.message?.tone).toBe("bad");
    }
  });

  it("deleting the carried letter takes the previous word back; restart clears", () => {
    let s = run(initialState(puzzle), [...taps(a), { type: "submit", at: 1 }, { type: "delete" }]);
    expect(s.words).toEqual([]);
    expect(s.current).toBe(a);
    s = run(s, [{ type: "submit", at: 2 }, { type: "restart" }]);
    expect(s.words).toEqual([]);
    expect(s.current).toBe("");
    expect(s.restarts).toBe(1);
  });

  it("the coach's word can be played, from scratch or with a restart", () => {
    let s = initialState(puzzle);
    for (let i = 0; i < 5 && !isSolved(s); i++) {
      const h = boxHint(s.puzzle, s.words)!;
      s = run(s, [{ type: "hint-used" }, { type: "play", word: h.word, restart: h.restart, at: i }]);
    }
    expect(isSolved(s)).toBe(true);
    expect(s.words.length).toBe(puzzle.par);
    expect(s.coached).toEqual(s.words);
    expect(s.hints).toBe(puzzle.par);
  });

  it("traces one continuous path of box positions", () => {
    const s = run(initialState(puzzle), [...taps(a), { type: "submit", at: 1 }, ...taps(b.slice(1, 3))]);
    const all = puzzle.sides.join("");
    expect(pathPositions(s)).toEqual(a.split("").map((c) => all.indexOf(c)));
    expect(pathPositions(s, s.current)).toEqual((a + b.slice(1, 3)).split("").map((c) => all.indexOf(c)));
  });
});
