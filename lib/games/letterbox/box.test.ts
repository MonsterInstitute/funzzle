import { describe, expect, it } from "vitest";
import { containsBlockedSubstring, isBlocked } from "@/lib/games/words/blocklist";
import { isCommon, isWord } from "@/lib/games/words/lexicon";
import { generateLetterBox } from "./generate";
import { bestPath, boxHint, checkWord, FULL, shortestFrom, traceable, usedMask, wordMask, type LetterBoxPuzzle } from "./index";

const dates = (n: number, from = "2026-10-01") =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

/** A chain is a solution when each word follows the last and every letter is used. */
function isSolution(p: LetterBoxPuzzle, words: string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    if (!traceable(words[i], p.sides)) return false;
    if (i && words[i][0] !== words[i - 1].slice(-1)) return false;
  }
  return usedMask(words, p.sides) === FULL;
}

describe("generateLetterBox", () => {
  it("is a pure function of the seed", () => {
    expect(generateLetterBox("letter-box:2026-10-24")).toEqual(generateLetterBox("letter-box:2026-10-24"));
    expect(generateLetterBox("letter-box:2026-10-24")).not.toEqual(generateLetterBox("letter-box:2026-10-25"));
  });

  it("makes a solvable box for 200 days in a row", () => {
    const days = dates(200);
    let withThree = 0;
    let genMs = 0;
    for (const date of days) {
      const t0 = performance.now();
      const p = generateLetterBox(`letter-box:${date}`);
      genMs += performance.now() - t0;
      const all = p.sides.join("");
      expect(p.sides.every((s) => s.length === 3), date).toBe(true);
      expect(new Set(all).size, date).toBe(12);
      const vowels = [...all].filter((c) => "aeiou".includes(c)).length;
      expect(vowels, date).toBeGreaterThanOrEqual(3);
      expect(vowels, date).toBeLessThanOrEqual(4);
      for (const s of p.sides) expect(containsBlockedSubstring(s) || containsBlockedSubstring([...s].reverse().join(""))).toBe(false);
      expect(new Set(p.words).size).toBe(p.words.length);
      const bad = p.words.filter(
        (w, i) => !traceable(w, p.sides) || !isWord(w) || isBlocked(w) || isCommon(w) !== i < p.common || wordMask(w, p.sides) === FULL
      );
      expect(bad, date).toEqual([]);
      expect(p.par).toBe(2);
      expect(p.solution).toHaveLength(p.par);
      expect(isSolution(p, p.solution), date).toBe(true);
      for (const w of p.solution) expect(p.words.indexOf(w)).toBeLessThan(p.common);
      // The solver from scratch agrees with par.
      expect(shortestFrom(p.sides, p.words, [], 4)).toHaveLength(p.par);
      if (hasThree(p)) withThree++;
    }
    console.log(`letter box: ${(genMs / days.length).toFixed(1)} ms per daily box, ${withThree}/${days.length} with a 3-word solution`);
    expect(withThree / days.length).toBeGreaterThan(0.95);
  });
});

function hasThree(p: LetterBoxPuzzle): boolean {
  const common = p.words.slice(0, p.common).map((w) => ({ w, m: wordMask(w, p.sides) }));
  const from = (ch: string) => common.filter((c) => c.w[0] === ch);
  for (const a of common) {
    for (const b of from(a.w.slice(-1))) {
      const need = FULL & ~(a.m | b.m);
      if (need && from(b.w.slice(-1)).some((c) => (c.m & need) === need)) return true;
    }
  }
  return false;
}

describe("rules", () => {
  const p = generateLetterBox("letter-box:2026-10-24");
  const [a, b] = p.solution;

  it("accepts the solution and explains rejections", () => {
    expect(checkWord(p, [], a)).toEqual({ ok: true });
    expect(checkWord(p, [a], b)).toEqual({ ok: true });
    expect(checkWord(p, [], "ab")).toEqual({ ok: false, reason: "short" });
    const wrongStart = p.words.find((w) => w[0] !== a.slice(-1))!;
    expect(checkWord(p, [a], wrongStart)).toEqual({ ok: false, reason: "start" });
    const sameSide = p.sides[0][0] + p.sides[0][1] + p.sides[1][0];
    expect(checkWord(p, [], sameSide)).toEqual({ ok: false, reason: "side" });
    const fake = p.sides[0][0] + p.sides[1][0] + p.sides[0][0] + p.sides[1][0] + p.sides[0][0];
    if (!p.words.includes(fake)) expect(checkWord(p, [], fake)).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("coach", () => {
  it("following the coach from scratch solves in par", () => {
    for (const date of dates(20)) {
      const p = generateLetterBox(`letter-box:${date}`);
      const played: string[] = [];
      for (let i = 0; i < 6 && usedMask(played, p.sides) !== FULL; i++) {
        const h = boxHint(p, played)!;
        expect(h.restart).toBe(false);
        expect(checkWord(p, played, h.word)).toEqual({ ok: true });
        played.push(h.word);
      }
      expect(isSolution(p, played)).toBe(true);
      expect(played.length).toBe(p.par);
    }
  });

  it("finishes a started chain, and suggests a restart when it can't", () => {
    const p = generateLetterBox("letter-box:2026-10-24");
    const start = p.words.slice(0, p.common).find((w) => w.length === 3)!;
    const path = bestPath(p, [start], 4);
    expect(path).not.toBeNull();
    const h = boxHint(p, [start])!;
    expect(h.word[0]).toBe(start.slice(-1));
    expect(h.pattern.startsWith(h.word[0].toUpperCase())).toBe(true);
    // No more words allowed: the hint falls back to a fresh start.
    const stuck = boxHint({ ...p, par: -10 }, [start])!;
    expect(stuck.restart).toBe(true);
    expect(stuck.nudge).toMatch(/Restart/);
  });
});
