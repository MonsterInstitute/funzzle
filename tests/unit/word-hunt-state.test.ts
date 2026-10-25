import { describe, expect, it } from "vitest";
import { hintLadder, pickHintWord } from "@/lib/games/wordhunt";
import { bankPuzzle } from "@/lib/games/wordhunt/server";
import { skillsOf } from "@/components/wordhunt/WordHuntGame";
import { BONUS_PER_HINT, claimedCells, earnedHints, foundSet, initialState, isComplete, judge, meter, reducer, shareMap, type Action, type PlayState } from "@/components/wordhunt/state";

const p = bankPuzzle("bake-sale")!;
const step = (s: PlayState, a: Action) => reducer(s, a, p);
const span = p.words.findIndex((w) => w.span);
const theme = p.words.findIndex((w) => !w.span);

describe("word hunt play state", () => {
  it("finds a theme word only along its own cells, in any order of repeated letters", () => {
    const w = p.words[theme];
    let s = step(initialState(), { type: "submit", path: w.path, at: 1200 });
    expect(s.found).toEqual([{ word: theme, at: 1200, revealed: false }]);
    expect(claimedCells(p, s).size).toBe(w.path.length);
    expect(judge(p, s, w.path)).toEqual({ kind: "again", word: w.word });
    s = step(s, { type: "submit", path: w.path, at: 1300 });
    expect(s.found).toHaveLength(1);
  });

  it("flags the span word", () => {
    expect(judge(p, initialState(), p.words[span].path)).toEqual({ kind: "theme", word: span, span: true });
  });

  it("counts bonus words, and every three earn a hint", () => {
    const bonusPaths = findBonusPaths(4);
    let s = initialState();
    for (let k = 0; k < BONUS_PER_HINT; k++) {
      const o = judge(p, s, bonusPaths[k]);
      expect(o.kind).toBe("bonus");
      expect(o.kind === "bonus" && o.earned).toBe(k === BONUS_PER_HINT - 1);
      s = step(s, { type: "submit", path: bonusPaths[k], at: k });
    }
    expect(s.bonus).toHaveLength(BONUS_PER_HINT);
    expect(earnedHints(s)).toBe(1);
    expect(meter(s)).toBe(0);
    // The same bonus word twice doesn't count.
    expect(judge(p, s, bonusPaths[0]).kind).toBe("again");
    s = step(s, { type: "hint", source: "earned" });
    expect(earnedHints(s)).toBe(0);
    expect(s.hints).toBe(0);
    // No earned hint left: spending one is a no-op.
    expect(step(s, { type: "hint", source: "earned" })).toBe(s);
  });

  it("rejects short and unknown traces", () => {
    const w = p.words[theme].path;
    expect(judge(p, initialState(), w.slice(0, 3)).kind).toBe("short");
    // A non-word made of the first four cells of the word in reverse, if it isn't a word.
    const rev = [...w.slice(0, 4)].reverse();
    const o = judge(p, initialState(), rev);
    if (o.kind === "unknown") expect(step(initialState(), { type: "submit", path: rev, at: 0 }).misses).toBe(1);
    expect(judge(p, initialState(), [0, 47]).kind).toBe("short");
  });

  it("reveals a word through the coach, completes, and summarizes without spoilers", () => {
    let s = step(initialState(), { type: "hint", source: "coach" });
    expect(s.hints).toBe(1);
    const ladder = hintLadder(p, foundSet(s))!;
    expect(p.words[ladder.word].span).toBe(false);
    expect(ladder.area.sort()).toEqual([...p.words[ladder.word].path].sort());
    expect(ladder.first).toBe(p.words[ladder.word].path[0]);
    s = step(s, { type: "reveal", word: ladder.word, at: 500 });
    expect(s.found[0]).toMatchObject({ word: ladder.word, revealed: true });
    p.words.forEach((w, i) => {
      if (i !== ladder.word) s = step(s, { type: "submit", path: w.path, at: 1000 + i });
    });
    expect(isComplete(p, s)).toBe(true);
    const map = shareMap(p, s);
    expect(map).toHaveLength(p.words.length);
    expect(map[0]).toBe("r");
    expect(map).toMatch(/^[rts]+$/);
    expect(map.split("s")).toHaveLength(2);
    expect(skillsOf(p, s, 200_000)).toEqual(expect.arrayContaining(["first-hunt", "span-solo", "quick"]));
    expect(skillsOf(p, s, 200_000)).not.toContain("unaided");
  });

  it("hints the span word last", () => {
    const others = new Set(p.words.map((_, i) => i).filter((i) => i !== span));
    expect(pickHintWord(p, new Set())).not.toBe(span);
    expect(pickHintWord(p, others)).toBe(span);
    expect(hintLadder(p, others)!.direction).toMatch(/span word/);
    expect(pickHintWord(p, new Set(p.words.map((_, i) => i)))).toBe(-1);
  });
});

/** Paths of `n` distinct bonus words, using only cells no theme word needs first. */
function findBonusPaths(n: number): number[][] {
  const out: number[][] = [];
  for (const b of p.bonus) {
    const path = trace(b.toUpperCase());
    if (path) out.push(path);
    if (out.length === n) break;
  }
  return out;
}

function trace(word: string): number[] | null {
  const used = new Set<number>();
  const go = (i: number, k: number, path: number[]): number[] | null => {
    if (p.grid[i] !== word[k] || used.has(i)) return null;
    path.push(i);
    used.add(i);
    if (k === word.length - 1) return path;
    const r = Math.floor(i / 6);
    const c = i % 6;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < 8 && cc >= 0 && cc < 6) {
          const found = go(rr * 6 + cc, k + 1, path);
          if (found) return found;
        }
      }
    path.pop();
    used.delete(i);
    return null;
  };
  for (let i = 0; i < 48; i++) {
    const r = go(i, 0, []);
    if (r) return r;
  }
  return null;
}
