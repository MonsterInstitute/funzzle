import { describe, expect, it } from "vitest";
import { isBlocked } from "../words/blocklist";
import { isCommon } from "../words/lexicon";
import { fillGrid, isComparative, isExcluded, FILL_EXCLUDE } from "./fill";
import { crosswordSizeFor, fillDailyGrid } from "./generate";
import { entriesOf, entryText, gridProblems, templateOf } from "./grid";
import { TEMPLATES } from "./templates";

function checkFill(template: string, grid: string) {
  expect(templateOf(grid)).toBe(template);
  expect(gridProblems(grid)).toEqual([]);
  const words = entriesOf(grid).map((e) => entryText(grid, e));
  expect(new Set(words).size).toBe(words.length);
  for (const w of words) {
    expect(isCommon(w), w).toBe(true);
    expect(isBlocked(w), w).toBe(false);
    expect(isExcluded(w, FILL_EXCLUDE), w).toBe(false);
  }
}

describe("crossword fill", () => {
  it("fills every 11×11 and 13×13 template with distinct everyday words", () => {
    for (const size of [11, 13] as const) {
      TEMPLATES[size].forEach((t, k) => {
        const res = fillGrid(t, { seed: `test:${size}:${k}` });
        expect(res, `${size} #${k}`).not.toBeNull();
        checkFill(t, res!.grid);
      });
    }
  }, 120_000);

  it("fills the weekend 15×15 templates", () => {
    TEMPLATES[15].forEach((t, k) => {
      const t0 = performance.now();
      const res = fillGrid(t, { seed: `test:15:${k}` });
      expect(res, `15 #${k}`).not.toBeNull();
      checkFill(t, res!.grid);
      expect(performance.now() - t0).toBeLessThan(15_000);
    });
  }, 180_000);

  it("is a pure function of the seed", () => {
    const t = TEMPLATES[11][0];
    expect(fillGrid(t, { seed: "same" })!.grid).toBe(fillGrid(t, { seed: "same" })!.grid);
  });

  it("fills a 13×13 daily in well under 10 seconds", () => {
    const t0 = performance.now();
    const g = fillDailyGrid("2026-10-23"); // a Friday: 13×13
    const ms = performance.now() - t0;
    expect(g.size).toBe(13);
    checkFill(TEMPLATES[13][g.template], g.grid);
    expect(ms).toBeLessThan(10_000);
  }, 30_000);

  it("keeps avoided words out", () => {
    const first = fillGrid(TEMPLATES[11][1], { seed: "avoid" })!;
    const avoid = new Set(entriesOf(first.grid).map((e) => entryText(first.grid, e)).filter((w) => w.length >= 5));
    const second = fillGrid(TEMPLATES[11][1], { seed: "avoid", avoid })!;
    for (const e of entriesOf(second.grid)) expect(avoid.has(entryText(second.grid, e))).toBe(false);
  });

  it("schedules 11×11 early in the week, 13×13 Thu/Fri, the big grid on weekends", () => {
    expect(crosswordSizeFor("2026-10-19")).toBe(11); // Mon
    expect(crosswordSizeFor("2026-10-22")).toBe(13); // Thu
    expect(crosswordSizeFor("2026-10-24")).toBe(15); // Sat
  });

  it("drops comparatives like soberer and slier", () => {
    const has = (w: string) => ["sober", "soberer", "soberest", "sly", "slier", "sliest", "rider"].includes(w);
    expect(isComparative("soberer", has)).toBe(true);
    expect(isComparative("slier", has)).toBe(true);
    expect(isComparative("rider", has)).toBe(false);
    expect(isExcluded("morons", new Set(["moron"]))).toBe(true);
  });
});
