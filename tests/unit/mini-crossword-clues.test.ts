import { describe, expect, it } from "vitest";
import { clueGrid } from "@/lib/cron/content/mini";
import { MINI_BANK, layoutOf } from "@/lib/games/mini";

const b = MINI_BANK[0];
const ids = layoutOf(b.rows).entries.map((e) => e.id);

/** A fake DeepSeek that answers from a script of replies. */
function fake(replies: Record<string, unknown>[]) {
  const prompts: string[] = [];
  const ask = (async (_job: string, prompt: string) => {
    prompts.push(prompt);
    return replies.shift() ?? {};
  }) as Parameters<typeof clueGrid>[1];
  return { ask, prompts };
}

describe("clueGrid (LLM clues)", () => {
  it("accepts a fully valid reply in one call", async () => {
    const { ask, prompts } = fake([{ ...b.clues }]);
    expect(await clueGrid(b.rows, ask)).toEqual(b.clues);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("SCOUT");
  });

  it("re-asks once for only the bad clues, naming the problem", async () => {
    const bad = { ...b.clues, "6A": "A scout's job", "9A": "x" };
    const { ask, prompts } = fake([bad, { "6A": "Look for new talent", "9A": "Spotted" }]);
    const out = await clueGrid(b.rows, ask);
    expect(out?.["6A"]).toBe("Look for new talent");
    expect(Object.keys(out!).sort()).toEqual([...ids].sort());
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("6A");
    expect(prompts[1]).toContain("contains the answer");
    expect(prompts[1]).not.toContain("1A (");
  });

  it("discards the grid when a clue is still bad after the retry", async () => {
    const { ask } = fake([{ ...b.clues, "1D": "" }, { "1D": "ADS" }]);
    expect(await clueGrid(b.rows, ask)).toBeNull();
  });

  it("survives a failing call", async () => {
    const ask = (async () => {
      throw new Error("timeout");
    }) as Parameters<typeof clueGrid>[1];
    expect(await clueGrid(b.rows, ask)).toBeNull();
  });
});
