/**
 * The DeepSeek content jobs for Word Search and Crossword, with the model and
 * the database mocked: replies are validated, bad ones retried or dropped,
 * and only valid puzzles are stored.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const deepSeekJson = vi.fn();
const stored: { sql: string; params: unknown[] }[] = [];

vi.mock("@/lib/deepseek", () => ({ deepSeekJson: (...a: unknown[]) => deepSeekJson(...a), hasDeepSeek: () => true }));
vi.mock("@/lib/db", () => ({
  all: async () => [],
  first: async () => null,
  exec: async () => 0,
  batch: async (rows: [string, ...unknown[]][]) => {
    for (const [sql, ...params] of rows) stored.push({ sql, params });
    return rows.length;
  },
  parseJson: (v: string) => JSON.parse(v),
}));

const { cleanTitle, dailyGridFor, ensureWordSearchPuzzles, prompt, themeFromModel, themesFromReply, wordSearchFor } = await import("@/lib/cron/content/wordsearch");
const { clueGrid, ensureCrosswordPuzzles } = await import("@/lib/cron/content/crossword");
const { entriesOf, entryText, BANK } = await import("@/lib/games/crossword");
const { puzzleProblems } = await import("@/lib/games/wordsearch");
const { todayISO, shiftISODate } = await import("@/lib/dates");

const THEME = {
  title: "Rainy Day",
  words: ["umbrella", "puddle", "raincoat", "thunder", "cloud", "drizzle", "boots", "storm", "window", "droplet", "gutter", "splash", "soggy", "drench", "shower", "misty", "breeze", "rainbow", "Ice Cream", "zzzq"],
};

beforeEach(() => {
  deepSeekJson.mockReset();
  stored.length = 0;
});

describe("word search themes", () => {
  it("keeps dictionary words only and rejects thin replies", async () => {
    deepSeekJson.mockResolvedValueOnce(THEME);
    const t = await themeFromModel("2030-01-01", []);
    expect(t?.words).not.toContain("ice cream");
    expect(t?.words).not.toContain("zzzq");
    deepSeekJson.mockResolvedValueOnce({ title: "Thin", words: ["cat", "dog"] });
    expect(await themeFromModel("2030-01-01", [])).toBeNull();
  });

  it("stores a validated grid for tomorrow and the bank grid for today", async () => {
    deepSeekJson.mockResolvedValueOnce({ title: "Bad", words: [] }).mockResolvedValueOnce(THEME);
    const today = todayISO();
    const tomorrow = shiftISODate(today, 1);
    const written = await ensureWordSearchPuzzles([today, tomorrow]);
    expect(written).toHaveLength(3);
    // The rejected first reply is reported, with why.
    expect(written[2]).toBe(`word-search ${tomorrow} ok after 1 rejected (2 calls): 1) call 1: "Bad": only 0 usable words`);
    const rows = stored.map((r) => ({ date: r.params[1], data: JSON.parse(r.params[2] as string) }));
    const t = rows.find((r) => r.date === tomorrow)!.data;
    expect(t.source).toBe("llm");
    expect(t.title).toBe("Rainy Day");
    expect(puzzleProblems(t)).toEqual([]);
    expect(rows.find((r) => r.date === today)!.data.source).toBe("bank");
    expect(deepSeekJson).toHaveBeenCalledTimes(2);
  });

  it("uses the second theme of a reply when the first can't be used", async () => {
    deepSeekJson.mockResolvedValueOnce({ themes: [{ title: "Ocean Life", words: THEME.words }, { ...THEME, title: "Rainy Day!" }] });
    const r = await wordSearchFor("2030-01-01", ["Ocean Life"]);
    expect(r.puzzle?.title).toBe("Rainy Day");
    expect(r.calls).toBe(1);
    expect(r.reasons).toEqual(['call 1: "Ocean Life": repeats a recent theme']);
  });

  it("cleans titles", () => {
    expect(cleanTitle("  Rainy  Day! ")).toBe("Rainy Day");
    expect(cleanTitle("Kids’ Corner")).toBe("Kids' Corner");
    expect(cleanTitle("100 Things")).toBe("Things");
    expect(cleanTitle(7)).toBe("");
  });

  it("the prompt's own example makes a valid grid", () => {
    const example = JSON.parse(prompt("2030-01-01", []).match(/Example of one theme \(pick others\): (\{.*\})/)![1]);
    const [{ theme, problems }] = themesFromReply(example, []);
    expect(problems).toEqual([]);
    expect(theme.words).toHaveLength(22);
    expect(dailyGridFor("2030-01-01", theme)).not.toBeNull();
  });

  it("reports every rejection when no theme works", async () => {
    deepSeekJson.mockRejectedValueOnce(new Error("DeepSeek reply cut off at 2000 tokens")).mockResolvedValue({ themes: [{ title: "Thin", words: ["cat"] }] });
    const r = await wordSearchFor("2030-01-01", []);
    expect(r.puzzle).toBeNull();
    expect(r.calls).toBe(3);
    expect(r.reasons[0]).toBe("call 1: DeepSeek reply cut off at 2000 tokens");
    expect(r.reasons[1]).toMatch(/"Thin": only 1 usable words/);
  });
});

describe("crossword clues", () => {
  const p = BANK[1];
  const entries = entriesOf(p.grid);

  it("asks again for clues that leak the answer, then succeeds", async () => {
    deepSeekJson.mockImplementation(async (_job: string, prompt: string) => {
      const ids = [...prompt.matchAll(/^(\d+[AD]) \(\d+\): ([A-Z]+)$/gm)].map((m) => [m[1], m[2]] as const);
      const first = deepSeekJson.mock.calls.length === 1;
      return {
        title: "Test Grid",
        // First round: one clue gives its answer away.
        clues: Object.fromEntries(ids.map(([id, ans], k) => [id, first && k === 0 ? `It's ${ans.toLowerCase()}` : p.clues[id]])),
      };
    });
    const out = await clueGrid(p.grid, entries);
    expect(out).not.toBeNull();
    expect(Object.keys(out!.clues)).toHaveLength(entries.length);
    // 2 batches of <= 40, then one retry for the leaked clue.
    expect(deepSeekJson.mock.calls.length).toBe(Math.ceil(entries.length / 40) + 1);
  });

  it("gives up (stores nothing) when clues stay invalid", async () => {
    deepSeekJson.mockResolvedValue({ clues: Object.fromEntries(entries.map((e) => [e.id, entryText(p.grid, e)])) });
    expect(await clueGrid(p.grid, entries)).toBeNull();
  });

  it("fills tomorrow's grid in code and stores it fully clued", async () => {
    deepSeekJson.mockImplementation(async (_job: string, prompt: string) => {
      const ids = [...prompt.matchAll(/^(\d+[AD]) \(\d+\): ([A-Z]+)$/gm)].map((m) => m[1]);
      return { title: "Fresh Fill", clues: Object.fromEntries(ids.map((id) => [id, `Clue number ${id}`])) };
    });
    const tomorrow = shiftISODate(todayISO(), 1);
    const written = await ensureCrosswordPuzzles([tomorrow, shiftISODate(todayISO(), 30)]);
    expect(written).toHaveLength(1); // more than a week ahead is skipped
    const row = JSON.parse(stored[0].params[2] as string);
    expect(row.source).toBe("llm");
    expect(Object.keys(row.clues)).toHaveLength(entriesOf(row.grid).length);
  }, 60_000);
});
