import { expect, test } from "@playwright/test";
import { stubWrites } from "./helpers";

test("homepage shows the Daily Set, 20 games and spoiler-free hints", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Daily Set");
  await expect(page.locator("#today article")).toHaveCount(4);
  await expect(page.locator("#games").getByText("Sudoku", { exact: true })).toBeVisible();
  await expect(page.locator("#games a, #games [aria-label$='coming soon']")).toHaveCount(20);

  // Hint ladder: hint 1 only, then hint 2, answer only on request.
  const answers = page.locator("#answers article").first();
  await expect(answers.getByText("Hint 1 of 2")).toBeVisible();
  await expect(answers.getByText("Answer", { exact: true })).toHaveCount(0);
  await answers.getByRole("button", { name: "Next hint" }).click();
  await expect(answers.getByText("Hint 2 of 2")).toBeVisible();
  await answers.getByRole("button", { name: "Reveal answer" }).click();
  await expect(answers.getByText("Answer", { exact: true })).toBeVisible();

  // Filter
  await page.getByRole("button", { name: "Cards 3" }).click();
  await expect(page.locator("#games a, #games [aria-label$='coming soon']")).toHaveCount(3);
});
