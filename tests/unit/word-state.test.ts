import { describe, expect, it } from "vitest";
import { boardMarks, initialGrid, keyStates, reducer, rejectReason, solvedAt, status, type GridState } from "@/components/word/state";
import { keyMove } from "@/components/word/WordGame";

const typeWord = (s: GridState, w: string) => [...w].reduce((st, ch) => reducer(st, { type: "type", ch }), s);
const play = (s: GridState, w: string, at = 1000) => reducer(typeWord(s, w), { type: "submit", at });

describe("word play state", () => {
  it("types, deletes and caps at the word length", () => {
    let s = typeWord(initialGrid("classic", ["robin"]), "SLATES");
    expect(s.current).toBe("slate");
    s = reducer(s, { type: "back" });
    expect(s.current).toBe("slat");
    expect(reducer(s, { type: "type", ch: "1" }).current).toBe("slat");
  });

  it("rejects short and unknown words without using a row", () => {
    let s = reducer(typeWord(initialGrid("classic", ["robin"]), "sla"), { type: "submit", at: 1 });
    expect(s.message).toBe("Not enough letters");
    expect(s.guesses).toEqual([]);
    s = reducer(typeWord(reducer(s, { type: "fill", guess: "" }), "zzzzz"), { type: "submit", at: 1 });
    expect(s.message).toBe("Not in the word list");
    expect(s.rejected).toBe(2);
    expect(s.guesses).toEqual([]);
  });

  it("wins on the answer and loses after six rows", () => {
    let s = play(initialGrid("classic", ["robin"]), "slate", 1200);
    expect(s.guessAt).toEqual([1200]);
    s = play(s, "robin");
    expect(status(s)).toBe("won");
    expect(reducer(s, { type: "type", ch: "a" })).toBe(s);
    let l = initialGrid("classic", ["robin"]);
    for (const w of ["slate", "crane", "pious", "dough", "mercy", "flock"]) l = play(l, w);
    expect(status(l)).toBe("lost");
  });

  it("enforces hard mode and only lets it change before the first guess", () => {
    let s = reducer(initialGrid("classic", ["robin"]), { type: "hard", on: true });
    expect(s.hard).toBe(true);
    s = play(s, "orbit"); // O, R yellow; B, I green
    expect(rejectReason(s, "slate")).toBe("Hard mode: 3rd spot must be B");
    expect(rejectReason(s, "rabid")).toBe("Hard mode: Guess must contain O");
    expect(rejectReason(s, "robin")).toBeNull();
    expect(reducer(s, { type: "hard", on: false }).hard).toBe(true);
  });

  it("quad: each board stops at its solving guess; keys show per-board states", () => {
    let s = initialGrid("quad", ["robin", "crane", "pluck", "ghost"]);
    expect(s.rows).toBe(9);
    s = play(play(s, "crane"), "robin");
    expect(solvedAt(s)).toEqual([1, 0, -1, -1]);
    expect(boardMarks(s, 1)).toHaveLength(1);
    expect(boardMarks(s, 2)).toHaveLength(2);
    expect(keyStates(s, 1).get("c")).toBe(2);
    expect(keyStates(s, 0).get("c")).toBe(0);
    s = play(play(s, "pluck"), "ghost");
    expect(status(s)).toBe("won");
  });

  it("math: accepts only true equations and operator keys", () => {
    let s = initialGrid("math", ["12+47=59"]);
    expect(s.length).toBe(8);
    s = typeWord(s, "12+46=59");
    expect(reducer(s, { type: "submit", at: 1 }).message).toBe("The left side is 58, not 59");
    s = play(reducer(s, { type: "fill", guess: "" }), "12+46=58");
    expect(boardMarks(s, 0)[0]).toEqual([2, 2, 2, 2, 0, 2, 2, 0]);
    expect(reducer(s, { type: "type", ch: "a" }).current).toBe("");
  });

  it("records coach reveals once", () => {
    let s = reducer(initialGrid("classic", ["robin"]), { type: "reveal", reveal: { board: 0, pos: 0, ch: "r" } });
    s = reducer(s, { type: "reveal", reveal: { board: 0, pos: 0, ch: "r" } });
    expect(s.reveals).toHaveLength(1);
  });

  it("finds the guess that cut the possibilities most", () => {
    const km = keyMove("classic", ["robin"], ["slate", "corny", "robin"])!;
    expect(km.before / Math.max(1, km.after)).toBeGreaterThan(1);
    expect(km.index).toBeLessThan(2);
  });
});
