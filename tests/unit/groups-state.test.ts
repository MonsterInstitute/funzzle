import { describe, expect, it } from "vitest";
import { BANK, earnedSkills, hintFor, initialOrder } from "@/lib/games/groups";
import { guessMap, guessRows, initialState, isLost, isOver, isWon, reducer, type Action, type PlayState } from "@/components/groups/state";

const puzzle = BANK[0];
const fresh = () => initialState(puzzle, initialOrder(puzzle, "test"));
const words = (g: number) => puzzle.groups[g].words as string[];
const play = (s: PlayState, ...actions: Action[]) => actions.reduce(reducer, s);
const pick = (s: PlayState, ws: string[]) => play(s, ...ws.map((word) => ({ type: "toggle", word }) as Action));
const submit = (s: PlayState, ws: string[], at = 1000) => play(pick(play(s, { type: "deselect" }), ws), { type: "submit", at });

describe("groups play state", () => {
  it("selects up to four words and toggles them off again", () => {
    let s = pick(fresh(), [...words(0), words(1)[0]]);
    expect(s.selected).toEqual(words(0));
    s = reducer(s, { type: "toggle", word: words(0)[1] });
    expect(s.selected).toHaveLength(3);
    expect(reducer(s, { type: "deselect" }).selected).toEqual([]);
  });

  it("solves a correct group, records when, and takes it off the board", () => {
    const s = submit(fresh(), words(2), 4200);
    expect(s.solved).toEqual([2]);
    expect(s.solvedAt).toEqual([4200]);
    expect(s.board).toHaveLength(12);
    expect(s.board.some((w) => words(2).includes(w))).toBe(false);
    expect(s.feedback?.kind).toBe("correct");
    expect(s.mistakes).toBe(0);
  });

  it("says one away for three of a group, counts mistakes, ignores repeats", () => {
    const guess = [...words(0).slice(0, 3), words(1)[0]];
    let s = submit(fresh(), guess);
    expect(s.feedback?.kind).toBe("one-away");
    expect(s.mistakes).toBe(1);
    s = submit(s, guess);
    expect(s.feedback?.kind).toBe("already");
    expect(s.mistakes).toBe(1);
    s = submit(s, [words(0)[0], words(0)[1], words(1)[0], words(1)[1]]);
    expect(s.feedback?.kind).toBe("wrong");
    expect(s.mistakes).toBe(2);
  });

  it("ignores a submit without four words", () => {
    const s = play(pick(fresh(), words(0).slice(0, 3)), { type: "submit", at: 1 });
    expect(s.guesses).toEqual([]);
  });

  it("completes the last group automatically and wins", () => {
    let s = submit(fresh(), words(3), 1000);
    s = submit(s, words(1), 2000);
    s = submit(s, words(0), 3000);
    expect(isWon(s)).toBe(true);
    expect(s.solved).toEqual([3, 1, 0, 2]);
    expect(s.board).toEqual([]);
    expect(guessMap(s)).toBe("4444222211113333");
    expect(guessRows(s)[0]).toBe("🟪🟪🟪🟪");
    expect(earnedSkills({ won: true, mistakes: 0, hints: 0, timeMs: 3000, solveOrder: s.solved, coached: s.coached })).toEqual(
      expect.arrayContaining(["solve", "perfect", "no-hint", "fast", "trickiest-first", "flawless"])
    );
  });

  it("loses after four mistakes and reveals the rest, easiest first", () => {
    let s = submit(fresh(), words(1));
    const wrong = (i: number) => [words(0)[0], words(2)[i], words(3)[0], words(3)[1]];
    for (let i = 0; i < 4; i++) s = submit(s, wrong(i));
    expect(s.mistakes).toBe(4);
    expect(isLost(s)).toBe(true);
    expect(isOver(s)).toBe(true);
    expect(s.revealed).toEqual([0, 2, 3]);
    expect(s.board).toEqual([]);
    // Nothing changes after the end.
    expect(reducer(s, { type: "toggle", word: words(0)[0] })).toBe(s);
    expect(earnedSkills({ won: false, mistakes: 4, hints: 0, timeMs: 1, solveOrder: s.solved, coached: [] })).toEqual([]);
  });

  it("coach hints point at the easiest unsolved group and can reveal it", () => {
    let s = fresh();
    const h = hintFor(puzzle, s.solved, s.board)!;
    expect(h.group).toBe(0);
    expect(words(0)).toContain(h.word);
    // The pointed word is the group's first tile on the board.
    expect(s.board.find((w) => words(0).includes(w))).toBe(h.word);
    s = play(s, { type: "hint-used" }, { type: "coach-reveal", group: 0, at: 500 });
    expect(s.hints).toBe(1);
    expect(s.coached).toEqual([0]);
    expect(s.guesses).toEqual([]);
    expect(hintFor(puzzle, s.solved, s.board)!.group).toBe(1);
    // A coach-revealed group never counts as "trickiest first" or "upside down".
    expect(earnedSkills({ won: true, mistakes: 0, hints: 3, timeMs: 1e6, solveOrder: [3, 2, 1, 0], coached: [3] })).not.toContain("trickiest-first");
  });

  it("shuffles deterministically by seed without losing words", () => {
    const s = fresh();
    const a = reducer(s, { type: "shuffle", seed: 7 });
    expect(reducer(s, { type: "shuffle", seed: 7 }).board).toEqual(a.board);
    expect([...a.board].sort()).toEqual([...s.board].sort());
  });
});
