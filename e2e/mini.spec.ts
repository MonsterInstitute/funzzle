import { expect, test } from "@playwright/test";
import { layoutOf } from "../lib/games/mini/grid";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily mini crossword: check, coach ladder, keyboard solve, recap and share", async ({ page }) => {
  await stubWrites(page, 58);
  await page.goto("/play/mini");
  await expect(page.getByRole("heading", { name: "Mini Crossword", exact: true })).toBeVisible();

  // Today's answers: the same stored row (or bank fallback) the page renders.
  const res = await page.request.get(`/api/daily-puzzle?game=mini-crossword&date=${today()}`);
  expect(res.ok()).toBe(true);
  const { rows } = (await res.json()) as { rows: string[] };
  const L = layoutOf(rows);
  const open = L.solution.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  const cell = (i: number) => page.getByRole("gridcell").nth(i);
  await expect(page.getByRole("gridcell")).toHaveCount(rows.length * rows.length);

  // A wrong letter (typed on the on-screen keyboard) shows up on Check.
  const first = open[0];
  await cell(first).click();
  const wrong = L.solution[first] === "Q" ? "Z" : "Q";
  await page.getByRole("group", { name: "Keyboard" }).getByRole("button", { name: wrong, exact: true }).click();
  await page.getByRole("button", { name: "Check" }).click();
  await expect(cell(first)).toHaveAccessibleName(/wrong/);
  await expect(page.getByText("Help 1")).toBeVisible();

  // Coach: easiest clue → a letter → the word.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "Show a letter" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the word" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("gridcell", { name: /revealed/ }).first()).toBeVisible();

  // Fill the rest with the physical keyboard.
  // (Decide up front: the board gives way to the recap on the last letter.)
  const labels = await page.getByRole("gridcell").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  const todo = open.filter((i) => !labels[i].endsWith(`: ${L.solution[i]}`) && !labels[i].includes(`: ${L.solution[i]}, revealed`));
  for (const i of todo) {
    await cell(i).click();
    await page.keyboard.press(L.solution[i].toLowerCase());
  }

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 58% of today’s players")).toBeVisible();
  await expect(page.getByText("Daily Set · 1 of 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const map = L.solution.map((x) => (x ? "1" : "0")).join("");
  const img = await page.request.get(`/api/share-card?g=mini-crossword&d=${today()}&t=48000&top=30&s=1&m=1&h=3&lv=5x5&map=${map}`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});
