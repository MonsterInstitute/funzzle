import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { ANSWERS5, VALID5 } from "@/lib/games/words/words5";
import { decodeMarks, encodeMarks, fits, hardModeViolation, knowledge, score, scoreCode, solvedCode, type Clue } from "./score";

describe("score", () => {
  it("marks right spot, wrong spot and absent", () => {
    expect(score("crane", "react")).toEqual([1, 1, 2, 0, 1]);
    expect(score("slate", "slate")).toEqual([2, 2, 2, 2, 2]);
    expect(score("pious", "slate")).toEqual([0, 0, 0, 0, 1]);
  });

  it("handles duplicate letters: greens first, then yellows while copies remain", () => {
    // One E in the answer: only the first misplaced E is yellow.
    expect(score("geese", "those")).toEqual([0, 0, 0, 2, 2]);
    expect(score("eerie", "ether")).toEqual([2, 1, 1, 0, 0]);
    // One E in the answer: the first E is yellow, the second gray.
    expect(score("speed", "abide")).toEqual([0, 0, 1, 0, 1]);
    expect(score("llama", "hello")).toEqual([1, 1, 0, 0, 0]);
  });

  it("packs the same marks into a base-3 code", () => {
    const rng = createRng("score-code");
    for (let i = 0; i < 2000; i++) {
      const g = VALID5.at(rng.int(VALID5.size));
      const a = ANSWERS5.at(rng.int(ANSWERS5.size));
      const marks = score(g, a);
      expect(scoreCode(g, a)).toBe(encodeMarks(marks));
      expect(decodeMarks(encodeMarks(marks), 5)).toEqual(marks);
    }
    expect(scoreCode("slate", "slate")).toBe(solvedCode(5));
    // Works for equations too.
    expect(score("12+46=58", "12+47=59")).toEqual([2, 2, 2, 2, 0, 2, 2, 0]);
  });

  it("knowledge.fits agrees with re-scoring every candidate", () => {
    const rng = createRng("knowledge");
    const pool = ANSWERS5.toArray();
    for (let t = 0; t < 40; t++) {
      const answer = pool[rng.int(pool.length)];
      const clues: Clue[] = [];
      for (let i = 0; i < 3; i++) {
        const g = VALID5.at(rng.int(VALID5.size));
        clues.push({ guess: g, marks: score(g, answer) });
      }
      const k = knowledge(clues, 5);
      const byCode = pool.filter((w) => clues.every((c) => scoreCode(c.guess, w) === encodeMarks(c.marks)));
      expect(pool.filter((w) => fits(w, k))).toEqual(byCode);
      expect(byCode).toContain(answer);
    }
  });

  it("lists ruled-out letters, but not letters capped by a duplicate", () => {
    const k = knowledge([{ guess: "speed", marks: score("speed", "abide") }], 5);
    expect(k.absent).toEqual(["s", "p"]);
    expect(k.exact.get("e")).toBe(1);
    expect(k.fixed[4]).toBe(null);
    expect([...k.notAt.get("e")!].sort()).toEqual([2, 3]);
  });

  it("hard mode: greens stay, yellows are reused", () => {
    const clues: Clue[] = [{ guess: "crane", marks: score("crane", "trace") }];
    // c(1) r(2) a(2) n(0) e(2)
    expect(hardModeViolation("brace", clues)).toBeNull();
    expect(hardModeViolation("trace", clues)).toBeNull();
    expect(hardModeViolation("grade", clues)).toBe("Guess must contain C");
    expect(hardModeViolation("crate", clues)).toBeNull();
    expect(hardModeViolation("cross", clues)).toBe("3rd spot must be A");
  });
});
