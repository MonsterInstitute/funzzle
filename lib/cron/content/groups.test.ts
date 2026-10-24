import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rows: [] as { puzzle_date: string }[], written: [] as unknown[][] }));
vi.mock("@/lib/db", () => ({
  all: vi.fn(async (sql: string) => (sql.includes("puzzle_date IN") ? db.rows : [])),
  batch: vi.fn(async (statements: unknown[][]) => {
    db.written.push(...statements);
    return statements.length;
  }),
  exec: vi.fn(async () => 0),
}));

import { shiftISODate, todayISO } from "@/lib/dates";
import { bankPuzzleFor, BANK } from "@/lib/games/groups";
import { ATTEMPTS, ensureGroupsPuzzles, generateGroups, parseGenerated, parseProblems } from "./groups";

const reply = (mutate?: (g: { level: number; title: string; hint: string; words: string[] }[]) => void) => {
  const groups = BANK[4].groups.map((g) => ({ level: g.level, title: g.title, hint: g.hint, words: [...g.words] }));
  mutate?.(groups);
  return { groups };
};

/** A fake DeepSeek: generation replies come from `gen`, ambiguity checks from `check`. */
function fakeAsk(gen: () => unknown, check: () => unknown) {
  const calls: string[] = [];
  const ask = async <T,>(job: string): Promise<T> => {
    calls.push(job);
    return (job === "content:groups" ? gen() : check()) as T;
  };
  return { ask, calls };
}

describe("groups content generation", () => {
  beforeEach(() => {
    db.rows = [];
    db.written = [];
  });

  it("accepts a valid reply, in level order, with an ai id", () => {
    const r = reply((g) => g.reverse());
    const p = parseGenerated(r, "2026-11-01");
    expect(p.id).toBe("ai-2026-11-01");
    expect(p.groups.map((g) => g.level)).toEqual([1, 2, 3, 4]);
  });

  it.each([
    ["a blocked word", (g: { words: string[] }[]) => (g[0].words[0] = "porn")],
    ["a made-up word", (g: { words: string[] }[]) => (g[0].words[0] = "flurbix")],
    ["a word over 14 chars", (g: { words: string[] }[]) => (g[1].words[1] = "extraordinarily")],
    ["a duplicate word", (g: { words: string[] }[]) => (g[1].words[0] = g[0].words[0].toUpperCase())],
    ["three words in a group", (g: { words: string[] }[]) => g[2].words.pop()],
    ["a long title", (g: { title: string }[]) => (g[3].title = "A very long title that goes on and on forever")],
    ["a hint that gives a word away", (g: { hint: string; words: string[] }[]) => (g[0].hint = `Think ${g[0].words[2]}`)],
    ["a missing level", (g: { level: number }[]) => (g[3].level = 3)],
  ])("rejects %s", (_name, mutate) => {
    expect(() => parseGenerated(reply(mutate as never), "2026-11-01")).toThrow();
  });

  it("allows capitalized proper nouns but checks lowercase words against the lexicon", () => {
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "Neptune")), "2026-11-01")).not.toThrow();
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "hot dog")), "2026-11-01")).not.toThrow();
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "hOt")), "2026-11-01")).toThrow();
  });

  it("fails closed on an unreadable ambiguity check", () => {
    expect(() => parseProblems({})).toThrow();
    expect(parseProblems({ problems: [] })).toEqual([]);
    expect(parseProblems({ problems: [{ words: ["king"], why: "also a chess piece" }] })).toHaveLength(1);
  });

  it("retries when the check finds another grouping, then gives up", async () => {
    let n = 0;
    const { ask, calls } = fakeAsk(
      () => reply(),
      () => ({ problems: n++ === 0 ? [{ words: ["desk", "globe", "king", "queen"], why: "all in a palace classroom" }] : [] })
    );
    expect((await generateGroups("2026-11-01", [], ask))?.id).toBe("ai-2026-11-01");
    expect(calls).toEqual(["content:groups", "content:groups-check", "content:groups", "content:groups-check"]);

    const bad = fakeAsk(() => reply(), () => ({ problems: [{ words: ["x"], why: "y" }] }));
    expect(await generateGroups("2026-11-01", [], bad.ask)).toBeNull();
    expect(bad.calls).toHaveLength(ATTEMPTS * 2);
  });

  it("rejects a puzzle that repeats a recent link", async () => {
    const { ask } = fakeAsk(() => reply(), () => ({ problems: [] }));
    expect(await generateGroups("2026-11-01", [BANK[4].groups[2].title], ask)).toBeNull();
  });

  it("stores the bank fallback for a live day, a generated puzzle for a future one, and skips stored days", async () => {
    const today = todayISO();
    const tomorrow = shiftISODate(today, 1);
    const later = shiftISODate(today, 2);
    db.rows = [{ puzzle_date: later }];
    const { ask } = fakeAsk(() => reply(), () => ({ problems: [] }));
    const wrote = await ensureGroupsPuzzles([today, tomorrow, later, "nonsense"], ask);
    expect(wrote).toEqual([`groups ${today} (bank)`, `groups ${tomorrow} (ai)`]);
    const stored = db.written.map((s) => JSON.parse(s[2] as string));
    expect(stored[0].puzzle.id).toBe(bankPuzzleFor(today).id);
    expect(stored[1].puzzle.id).toBe(`ai-${tomorrow}`);
  });
});
