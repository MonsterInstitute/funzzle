import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ written: [] as unknown[][] }));
vi.mock("@/lib/db", () => ({
  all: vi.fn(async () => []),
  batch: vi.fn(async (statements: unknown[][]) => {
    db.written.push(...statements);
    return statements.length;
  }),
  exec: vi.fn(async () => 0),
}));

import { shiftISODate, todayISO } from "@/lib/dates";
import { CELLS } from "@/lib/games/wordhunt/grid";
import { themeProblems } from "@/lib/games/wordhunt/validate";
import { ATTEMPTS, aiPuzzle, ensureWordHuntPuzzles, parsePool, prompt, themesFrom, wordSets } from "./wordhunt";

const GOOD = {
  title: "Rise and shine",
  spans: ["breakfast", "morningmeal"],
  words: ["oatmeal", "granola", "cereal", "omelet", "pancake", "waffle", "toast", "bacon", "muffin", "yogurt", "coffee", "juice", "bagel", "sausage"],
};

function fakeAsk(...replies: unknown[]) {
  const prompts: string[] = [];
  const ask = async <T,>(_job: string, p: string): Promise<T> => {
    prompts.push(p);
    const r = replies[Math.min(prompts.length - 1, replies.length - 1)];
    if (r instanceof Error) throw r;
    return r as T;
  };
  return { ask, prompts };
}

describe("word hunt AI themes", () => {
  beforeEach(() => {
    db.written = [];
  });

  it("finds word sets that add up exactly, best (earliest) words first", () => {
    const sets = wordSets([7, 7, 6, 6, 7, 6, 5, 5], 39);
    expect(sets.length).toBeGreaterThan(0);
    for (const s of sets) {
      expect(s.reduce((n, i) => n + [7, 7, 6, 6, 7, 6, 5, 5][i], 0)).toBe(39);
      expect(s.length).toBeGreaterThanOrEqual(5);
      expect(s.length).toBeLessThanOrEqual(8);
    }
    expect(sets[0].slice(0, 3)).toEqual([0, 1, 2]);
    expect(wordSets([4, 4, 4], 39)).toEqual([]);
  });

  it("cleans a reply and drops bad words one at a time", () => {
    const pool = parsePool({
      title: "Rise and shine",
      span: "Break-fast",
      words: ["Oat Meal", "qzxvbnm", "shine", "granola", "ok", "cereal", "omelet", "pancake", "waffle"],
    });
    expect(pool.problems).toEqual([]);
    expect(pool.spans).toEqual(["breakfast"]);
    expect(pool.words).toEqual(["oatmeal", "granola", "cereal", "omelet", "pancake", "waffle"]);
    expect(pool.dropped.join()).toMatch(/qzxvbnm.*dictionary/);
    expect(pool.dropped.join()).toMatch(/shine.*title/);
    expect(parsePool({ title: 5, span: null, words: "x" }).problems.length).toBeGreaterThan(0);
  });

  it("builds exactly-48-letter themes that pass the strict checks", () => {
    const themes = themesFrom("2026-11-01", parsePool(GOOD));
    expect(themes.length).toBeGreaterThan(1);
    for (const t of themes) {
      expect([t.span, ...t.words].join("").length).toBe(CELLS);
      expect(themeProblems(t)).toEqual([]);
    }
    // Both spans get a turn.
    expect(new Set(themes.map((t) => t.span)).size).toBe(2);
  });

  it("the prompt's own example makes a puzzle", async () => {
    const example = JSON.parse(prompt([], null).match(/Example \(a different theme\): (\{.*\})/)![1]);
    const { ask } = fakeAsk(example);
    const r = await aiPuzzle("2026-11-01", [], ask);
    expect(r.puzzle?.puzzle.grid).toHaveLength(CELLS);
    expect(r.reasons).toEqual([]);
  });

  it("retries with the problems spelled out, then succeeds", async () => {
    const { ask, prompts } = fakeAsk({ title: "Rise and shine", spans: ["breakfast"], words: ["toast", "bagel"] }, GOOD);
    const r = await aiPuzzle("2026-11-01", [], ask);
    expect(r.puzzle).not.toBeNull();
    expect(r.calls).toBe(2);
    expect(r.reasons[0]).toMatch(/only 2 usable theme words/);
    expect(prompts[1]).toMatch(/previous answer was rejected: only 2 usable/);
  });

  it("skips a recently used span and rejects a recent title", async () => {
    const { ask } = fakeAsk(GOOD);
    const r = await aiPuzzle("2026-11-01", ["breakfast"], ask);
    expect(r.puzzle?.puzzle.words.find((w) => w.span)?.word).toBe("MORNINGMEAL");
    const again = await aiPuzzle("2026-11-01", ["rise and shine"], fakeAsk(GOOD).ask);
    expect(again.puzzle).toBeNull();
    expect(again.reasons).toHaveLength(ATTEMPTS);
  });

  it("records call failures and gives up after ATTEMPTS", async () => {
    const { ask } = fakeAsk(new Error("DeepSeek reply cut off at 1500 tokens"));
    const r = await aiPuzzle("2026-11-01", [], ask);
    expect(r.puzzle).toBeNull();
    expect(r.calls).toBe(ATTEMPTS);
    expect(r.reasons[0]).toMatch(/cut off/);
  });

  it("stores an AI puzzle for tomorrow, the bank for today when the AI fails, and reports why", async () => {
    const today = todayISO();
    const tomorrow = shiftISODate(today, 1);
    let n = 0;
    const ask = async <T,>(): Promise<T> => (n++ < ATTEMPTS ? { title: "x" } : GOOD) as T;
    const wrote = await ensureWordHuntPuzzles([today, tomorrow], ask);
    expect(wrote[0]).toMatch(new RegExp(`^word-hunt ${today} \\(bank: `));
    expect(wrote[1]).toBe(`word-hunt ${tomorrow} (ai: Rise and shine)`);
    expect(wrote[2]).toMatch(`word-hunt ${today} failed, ${ATTEMPTS} rejected (${ATTEMPTS} calls): 1) reply 1: the title must be 3–40 characters`);
    expect(db.written).toHaveLength(2);
  });
});
