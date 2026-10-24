import { expect, test, type Page } from "@playwright/test";
import type { GroupsPuzzle } from "../lib/games/groups/puzzle";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tile = (page: Page, word: string) => page.getByRole("button", { name: new RegExp(`^${escape(word.toUpperCase())}(,|$)`) });

async function pick(page: Page, words: readonly string[]) {
  for (const w of words) await tile(page, w).click();
}

test("groups: one away, shuffle, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 73);
  await page.goto("/play/groups");
  await expect(page.getByRole("heading", { name: "Groups", exact: true })).toBeVisible();
  // Today's board, as the page renders it (the API serves the same getDailyGroups row or fallback).
  const res = await page.request.get(`/api/daily-puzzle?game=groups&date=${today()}`);
  const { puzzle } = (await res.json()) as { puzzle: GroupsPuzzle };
  const words = (g: number) => puzzle.groups[g].words;
  await expect(tile(page, words(0)[0])).toBeVisible();

  // Three of one group plus one other: "one away", a mistake.
  await pick(page, [...words(0).slice(0, 3), words(1)[0]]);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("One away…")).toBeVisible();
  await expect(page.getByText("3 of 4 mistakes left")).toBeAttached();

  // Deselect and shuffle keep every word on the board.
  await page.getByRole("button", { name: "Deselect" }).click();
  await expect(tile(page, words(0)[0])).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Shuffle" }).click();
  await expect(page.getByRole("group", { name: /Words/ }).getByRole("button")).toHaveCount(16);

  // Coach: a word in the easiest group → its theme → reveal the group.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the group" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await expect(page.getByRole("status", { name: new RegExp(`Level 1 group: ${escape(puzzle.groups[0].title)}`) })).toBeVisible();
  await coach.getByRole("button", { name: "Got it" }).click();

  // Level 4 with the mouse, level 3 with the keyboard (Space on focused tiles, Enter submits).
  await pick(page, words(3));
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("status", { name: new RegExp(`Level 4 group`) })).toBeVisible();
  for (const w of words(2)) {
    await tile(page, w).focus();
    await page.keyboard.press("Space");
  }
  await page.keyboard.press("Enter");

  // The last group completes itself, then the recap.
  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Ahead of 73% of today’s players")).toBeVisible();
  await expect(page.getByText("The groups, in the order you found them")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=groups&d=${today()}&t=95000&s=1&m=1&h=1&lv=Daily&f=4&map=1112444433332222&top=27`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});
