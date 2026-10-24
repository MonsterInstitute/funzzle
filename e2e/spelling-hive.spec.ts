import { expect, test } from "@playwright/test";
import { generateDailyHive } from "../lib/games/dailyPuzzles";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("spelling hive: type and tap words, bonus and rejects, coach ladder, finish, recap and share", async ({ page }) => {
  await stubWrites(page, 61);
  await page.goto("/play/spelling-hive");
  await expect(page.getByRole("heading", { name: "Spelling Hive", exact: true })).toBeVisible();
  // The daily hive is a pure function of the date (a stored row is generated the same way).
  const p = generateDailyHive(today());
  const hive = page.getByRole("group", { name: "Hive letters" });
  await expect(hive.getByRole("button", { name: `Center letter ${p.center.toUpperCase()}` })).toBeVisible();

  // Tap a word on the honeycomb.
  const first = p.answers.find((w) => w.length === 4) ?? p.answers[0];
  for (const ch of first) {
    const name = ch === p.center ? `Center letter ${ch.toUpperCase()}` : `Letter ${ch.toUpperCase()}`;
    await hive.getByRole("button", { name, exact: true }).click();
  }
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("+");

  // A word without the center letter is rejected with a reason.
  const noCenter = (p.outer[0] + p.outer[1] + p.outer[0] + p.outer[1]).toLowerCase();
  await page.keyboard.type(noCenter);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Use the center letter");

  // Coach: start → pattern → word.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await expect(coach).toContainText(/starting with [A-Z]{2}/);
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await expect(coach).toContainText(/_/);
  await coach.getByRole("button", { name: "Show the word" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();

  // The free hints grid.
  await page.getByRole("button", { name: "Hints grid" }).click();
  await expect(page.getByRole("region", { name: "Hints grid" })).toContainText("Two-letter starts");

  // Type longer answers with the keyboard until Genius.
  const byLength = [...p.answers].sort((a, b) => b.length - a.length);
  for (const w of byLength) {
    if (await page.getByText(/^Genius! /).isVisible()) break;
    await page.keyboard.type(w);
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText(/^Genius! /)).toBeVisible();

  // Finish for today → recap.
  await page.getByRole("button", { name: "Finish for today" }).click();
  await page.getByRole("dialog", { name: "Finish for today" }).getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByText("Genius.", { exact: true })).toBeVisible();
  await expect(page.getByText("Scored higher than 61% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  await expect(page.getByRole("button", { name: /See the \d+ words? you missed/ })).toBeVisible();

  const img = await page.request.get(`/api/share-card?g=spelling-hive&d=${today()}&t=600000&top=39&s=1&h=1&sc=140&w=30&lv=Genius`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: the finished hive is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Genius.", { exact: true })).toBeVisible();
});
