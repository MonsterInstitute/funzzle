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
import {
  CHECK_ROUNDS,
  GEN_ATTEMPTS,
  ensureGroupsPuzzles,
  generateGroups,
  generationPrompt,
  normalizeWord,
  parseCandidates,
  parseGenerated,
  parseProblems,
  repair,
} from "./groups";

type G = { level: number; title: string; hint: string; words: string[] };

const reply = (mutate?: (g: G[]) => void) => {
  const groups = BANK[4].groups.map((g) => ({ level: g.level as number, title: g.title, hint: g.hint, words: [...g.words] as string[] }));
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
    ["a blocked word", (g: G[]) => (g[0].words[0] = "porn")],
    ["a made-up word", (g: G[]) => (g[0].words[0] = "flurbix")],
    ["a word over 14 chars", (g: G[]) => (g[1].words[1] = "extraordinarily")],
    ["a duplicate word", (g: G[]) => (g[1].words[0] = g[0].words[0].toUpperCase())],
    ["three words in a group", (g: G[]) => g[2].words.pop()],
    ["a long title", (g: G[]) => (g[3].title = "A very long title that goes on and on forever")],
    ["a hint that gives a word away", (g: G[]) => (g[0].hint = `Think ${g[0].words[2]}`)],
  ])("rejects %s when the group has no spare word", (_name, mutate) => {
    expect(() => parseGenerated(reply(mutate), "2026-11-01")).toThrow();
  });

  it("assigns levels by order when the reply's levels aren't 1–4 once each", () => {
    const p = parseGenerated(reply((g) => (g[3].level = 3)), "2026-11-01");
    expect(p.groups.map((g) => g.level)).toEqual([1, 2, 3, 4]);
    expect(p.groups[3].title).toBe(BANK[4].groups[3].title);
  });

  it("allows capitalized proper nouns but checks lowercase words against the lexicon", () => {
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "Neptune")), "2026-11-01")).not.toThrow();
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "hot dog")), "2026-11-01")).not.toThrow();
    expect(() => parseGenerated(reply((g) => (g[0].words[0] = "hOt")), "2026-11-01")).toThrow();
  });

  it("drops bad candidates one by one and keeps the rest as spares", () => {
    const r = reply((g) => {
      g[0].words.unshift("flurbix", "PORN"); // not a word; blocked (in ALL CAPS)
      g[0].words.push("SPARE");
      g[1].words.push(g[2].words[0]); // listed in two groups: dropped from both
      g[2].words.push("extra", "another");
    });
    const { puzzle, spares, dropped } = parseCandidates(r, "2026-11-01");
    expect(puzzle.groups[0].words).toEqual(BANK[4].groups[0].words);
    expect(spares[0]).toEqual(["spare"]);
    expect(puzzle.groups[2].words).toEqual([...BANK[4].groups[2].words.slice(1), "extra"]);
    expect(spares[2]).toEqual(["another"]);
    expect(dropped.join(" ")).toMatch(/flurbix/);
    expect(dropped.join(" ")).toMatch(/in two groups/);
  });

  it("normalizes spacing, curly quotes and ALL CAPS", () => {
    expect(normalizeWord("  HOT   DOG ")).toBe("hot dog");
    expect(normalizeWord("PARIS")).toBe("Paris");
    expect(normalizeWord("it’s")).toBe("it's");
  });

  it("the prompt's own example passes every check", () => {
    const json = generationPrompt("2026-11-01", []).match(/\{"groups":[\s\S]*?\]\}\n/)![0];
    const { puzzle, spares } = parseCandidates(JSON.parse(json), "2026-11-01");
    expect(puzzle.groups).toHaveLength(4);
    expect(spares.map((s) => s.length)).toEqual([2, 2, 2, 2]);
  });

  it("swaps a flagged word for a spare from its group", () => {
    const { puzzle, spares } = parseCandidates(reply((g) => g[1].words.push("spare")), "2026-11-01");
    const flagged = puzzle.groups[1].words[2];
    const fixed = repair(puzzle, spares, [{ words: [flagged], why: "fits group 1 too" }]);
    expect(typeof fixed).toBe("object");
    expect((fixed as typeof puzzle).groups[1].words).toContain("spare");
    expect((fixed as typeof puzzle).groups[1].words).not.toContain(flagged);
    // No spares left, or a flag that names no board word: can't be fixed.
    expect(repair(puzzle, [[], [], [], []], [{ words: [puzzle.groups[0].words[0]], why: "x" }])).toMatch(/unfixable/);
    expect(repair(puzzle, spares, [{ words: ["nothere"], why: "x" }])).toMatch(/unfixable/);
  });

  it("fails closed on an unreadable ambiguity check", () => {
    expect(() => parseProblems({})).toThrow();
    expect(parseProblems({ problems: [] })).toEqual([]);
    expect(parseProblems({ problems: [{ words: ["king"], why: "also a chess piece" }] })).toHaveLength(1);
  });

  it("treats a word the per-word checks mark as not fitting as a problem", () => {
    const checks = [
      { word: "tonight", how: "to(two)night", fits: true },
      { word: "canyon", how: "no number inside", fits: false },
      { word: "Wisdom", how: "no number", fits: false },
    ];
    const problems = parseProblems({ checks, problems: [{ words: ["wisdom"], why: "no hidden number" }] });
    expect(problems.map((p) => p.words[0])).toEqual(["wisdom", "canyon"]);
  });

  it("repairs a flagged word with a spare, then re-checks", async () => {
    let n = 0;
    const { ask, calls } = fakeAsk(
      () => reply((g) => g[0].words.push("spare")),
      () => ({ problems: n++ === 0 ? [{ words: [BANK[4].groups[0].words[1]], why: "also fits level 2" }] : [] })
    );
    const r = await generateGroups("2026-11-01", [], ask);
    expect(r.puzzle?.groups[0].words).toContain("spare");
    expect(calls).toEqual(["content:groups", "content:groups-check", "content:groups-check"]);
    expect(r.reasons).toHaveLength(1);
    expect(r.calls).toBe(3);
  });

  it("gives up after GEN_ATTEMPTS when flags can't be fixed, with every reason", async () => {
    const bad = fakeAsk(() => reply(), () => ({ problems: [{ words: [BANK[4].groups[0].words[0]], why: "y" }] }));
    const r = await generateGroups("2026-11-01", [], bad.ask);
    expect(r.puzzle).toBeNull();
    expect(bad.calls).toHaveLength(GEN_ATTEMPTS * 2);
    expect(r.reasons.filter((x) => x.startsWith("gen")).join()).toMatch(/unfixable/);
  });

  it("stops after CHECK_ROUNDS checks per generation", async () => {
    let k = 0;
    const { ask, calls } = fakeAsk(
      // Plenty of spares: BANK[7]'s words.
      () => reply((g) => g.forEach((x, i) => x.words.push(...BANK[7].groups[i].words))),
      () => ({ problems: [{ words: [BANK[4].groups[0].words[k++ % 4]], why: "y" }] })
    );
    const r = await generateGroups("2026-11-01", [], ask);
    expect(r.calls).toBeLessThanOrEqual(GEN_ATTEMPTS * (1 + CHECK_ROUNDS));
    expect(calls.filter((c) => c === "content:groups-check").length).toBeLessThanOrEqual(GEN_ATTEMPTS * CHECK_ROUNDS);
  });

  it("fails closed on an unreadable check reply", async () => {
    const { ask } = fakeAsk(() => reply(), () => ({}));
    const r = await generateGroups("2026-11-01", [], ask);
    expect(r.puzzle).toBeNull();
    expect(r.reasons.join()).toMatch(/no problems list/);
  });

  it("rejects a puzzle that repeats a recent link", async () => {
    const { ask } = fakeAsk(() => reply(), () => ({ problems: [] }));
    const r = await generateGroups("2026-11-01", [BANK[4].groups[2].title], ask);
    expect(r.puzzle).toBeNull();
    expect(r.reasons[0]).toMatch(/repeats a recent link/);
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

  it("reports why a future date failed, in the returned lines", async () => {
    const tomorrow = shiftISODate(todayISO(), 1);
    const { ask } = fakeAsk(() => ({ groups: [] }), () => ({ problems: [] }));
    const wrote = await ensureGroupsPuzzles([tomorrow], ask);
    expect(wrote).toHaveLength(1);
    expect(wrote[0]).toMatch(`groups ${tomorrow} failed, 2 rejected (2 calls): 1) gen 1: reply needs 4 groups`);
    expect(db.written).toHaveLength(0);
  });
});
