import { describe, expect, it } from "vitest";
import { allFound, answersFound, bonusFound, initialState, missed, rank, reducer, score, shuffled, type Action, type HiveState } from "@/components/hive/state";
import { generateHive } from "@/lib/games/hive/generate";
import { GENIUS, hiveHint, RANKS, TOP } from "@/lib/games/hive";

const puzzle = generateHive("spelling-hive:2026-10-24");
const run = (s: HiveState, actions: Action[]) => actions.reduce(reducer, s);
const type = (word: string): Action[] => [...word.split("").map((letter) => ({ type: "type", letter }) as Action), { type: "submit", at: 1000 }];

describe("spelling hive reducer", () => {
  it("scores answers, keeps bonus words for no points, rejects with a reason", () => {
    let s = initialState(puzzle);
    const word = puzzle.answers.find((w) => w.length === 4)!;
    s = run(s, type(word));
    expect(s.found).toEqual([word]);
    expect(score(s)).toBe(1);
    expect(s.message?.tone).toBe("good");
    expect(s.input).toBe("");

    if (puzzle.bonus.length) {
      s = run(s, type(puzzle.bonus[0]));
      expect(bonusFound(s)).toEqual([puzzle.bonus[0]]);
      expect(score(s)).toBe(1);
      expect(s.message?.tone).toBe("bonus");
    }

    const before = s.mistakes;
    s = run(s, type("zzzz"));
    expect(s.mistakes).toBe(before + 1);
    expect(s.message?.tone).toBe("bad");
    // A repeat is rejected but isn't a mistake.
    s = run(s, type(word));
    expect(s.mistakes).toBe(before + 1);
    expect(s.message?.text).toBe("Already found");
  });

  it("pangrams get the bonus and their own message", () => {
    const s = run(initialState(puzzle), type(puzzle.pangrams[0]));
    expect(s.message?.tone).toBe("pangram");
    expect(score(s)).toBe(puzzle.pangrams[0].length + 7);
  });

  it("delete and clear edit the input; shuffle reorders the outer letters", () => {
    let s = run(initialState(puzzle), [
      { type: "type", letter: "A" },
      { type: "type", letter: "b" },
      { type: "delete" },
    ]);
    expect(s.input).toBe("a");
    s = reducer(s, { type: "clear" });
    expect(s.input).toBe("");
    const order = shuffled(s.order, () => 0.3);
    expect(order).not.toBe(s.order);
    expect([...order].sort()).toEqual([...s.order].sort());
    expect(reducer(s, { type: "shuffle", order }).order).toBe(order);
  });

  it("coach reveals count as hints and reach Hive Master", () => {
    let s = initialState(puzzle);
    while (!allFound(s)) {
      const h = hiveHint(s.puzzle, s.found)!;
      s = run(s, [{ type: "hint-used" }, { type: "reveal", word: h.word, at: 5 }]);
    }
    expect(rank(s)).toBe(TOP);
    expect(RANKS[rank(s)].name).toBe("Hive Master");
    expect(s.hints).toBe(puzzle.answers.length);
    expect(s.coached).toHaveLength(puzzle.answers.length);
    expect(missed(s)).toEqual([]);
    expect(answersFound(s)).toHaveLength(puzzle.answers.length);
  });

  it("reaches Genius before every word", () => {
    let s = initialState(puzzle);
    const byValue = [...puzzle.answers].sort((a, b) => b.length - a.length);
    for (const w of byValue) {
      if (rank(s) >= GENIUS) break;
      s = run(s, type(w));
    }
    expect(rank(s)).toBe(GENIUS);
    expect(missed(s).length).toBeGreaterThan(0);
  });
});
