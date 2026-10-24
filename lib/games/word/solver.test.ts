import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/games/kit/rng";
import { ANSWERS5, VALID5 } from "@/lib/games/words/words5";
import { answerPool, boardCandidates, gridHint, OPENERS } from "./coach";
import { mathAnswers, validateEquation } from "./math";
import { hardModeViolation, score } from "./score";
import { bestGuess, filterCandidates, rateGuess } from "./solver";

/** Play a puzzle by always taking the coach's suggestion; returns guesses used (or Infinity). */
function autoplay(mode: "classic" | "quad" | "math", answers: string[], rows: number, hard = false): number {
  const guesses: string[] = [];
  while (guesses.length < rows) {
    const hint = gridHint({ mode, answers, guesses, hard });
    if (!hint) return guesses.length;
    const remaining = boardCandidates(mode, answers, guesses).filter((c) => c.length);
    const next = hint.suggestion ?? remaining.find((c) => c.length === 1)![0];
    guesses.push(next);
  }
  return gridHint({ mode, answers, guesses }) ? Infinity : guesses.length;
}

describe("solver", () => {
  it("keeps exactly the answers consistent with the clues", () => {
    const pool = ANSWERS5.toArray();
    const clues = ["slate", "crony"].map((g) => ({ guess: g, marks: score(g, "robin") }));
    const left = filterCandidates(pool, clues);
    expect(left).toContain("robin");
    for (const w of left) for (const c of clues) expect(score(c.guess, w)).toEqual(c.marks);
  });

  it("the stored opener is the solver's own first choice", () => {
    const t = performance.now();
    const best = bestGuess([ANSWERS5.toArray()], { guessWords: VALID5.toArray() });
    const ms = performance.now() - t;
    expect(best!.guess).toBe(OPENERS.classic);
    console.log(`classic opener ${best!.guess} ${best!.bits.toFixed(2)} bits in ${ms.toFixed(0)} ms`);
    // Math's opener came from a larger sample; it must beat the quick search.
    const m = mathAnswers();
    const quick = bestGuess([m], { maxCandidates: 120 })!;
    expect(validateEquation(OPENERS.math)).toBeNull();
    expect(rateGuess(OPENERS.math, [m]).bits).toBeGreaterThanOrEqual(quick.bits);
  });

  it("solves classic answers in six (coach suggestions only), averaging under four", () => {
    const rng = createRng("autoplay");
    const pool = answerPool("classic");
    const runs: number[] = [];
    const t = performance.now();
    for (let i = 0; i < 60; i++) runs.push(autoplay("classic", [pool[rng.int(pool.length)]], 6));
    const ms = (performance.now() - t) / runs.length;
    expect(Math.max(...runs)).toBeLessThanOrEqual(6);
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(avg).toBeLessThan(4);
    console.log(`classic autoplay: avg ${avg.toFixed(2)} guesses, ${ms.toFixed(0)} ms per game`);
  });

  it("hard-mode suggestions always obey hard mode", () => {
    const rng = createRng("hard");
    const pool = answerPool("classic");
    for (let i = 0; i < 15; i++) {
      const answer = pool[rng.int(pool.length)];
      const guesses = ["slate"];
      for (let r = 0; r < 4 && guesses[guesses.length - 1] !== answer; r++) {
        const hint = gridHint({ mode: "classic", answers: [answer], guesses, hard: true })!;
        const g = hint.suggestion ?? boardCandidates("classic", [answer], guesses)[0][0];
        const clues = guesses.map((x) => ({ guess: x, marks: score(x, answer) }));
        expect(hardModeViolation(g, clues)).toBeNull();
        guesses.push(g);
      }
    }
  });

  it("solves Quad in nine", () => {
    const rng = createRng("quad-autoplay");
    const pool = answerPool("quad");
    const t = performance.now();
    for (let i = 0; i < 6; i++) {
      const answers = [0, 1, 2, 3].map(() => pool[rng.int(pool.length)]);
      expect(autoplay("quad", [...new Set(answers)], 9)).toBeLessThanOrEqual(9);
    }
    console.log(`quad autoplay: ${((performance.now() - t) / 6).toFixed(0)} ms per game`);
  });

  it("solves Math in six", () => {
    const rng = createRng("math-autoplay");
    const pool = mathAnswers();
    const runs: number[] = [];
    const t = performance.now();
    for (let i = 0; i < 12; i++) runs.push(autoplay("math", [pool[rng.int(pool.length)]], 6));
    expect(Math.max(...runs)).toBeLessThanOrEqual(6);
    console.log(`math autoplay: avg ${(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(2)} guesses, ${((performance.now() - t) / runs.length).toFixed(0)} ms per game`);
  });
});
