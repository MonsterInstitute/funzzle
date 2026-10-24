import { expect, test } from "@playwright/test";
import { stubWrites } from "./helpers";

test("daily freecell: the coach's best moves win the daily deal", async ({ page }) => {
  await stubWrites(page, 40);
  await page.goto("/play/freecell");
  await expect(page.getByRole("heading", { name: "Daily FreeCell", exact: true })).toBeVisible();
  await expect(page.getByText("Winnable deal")).toBeVisible();
  const coach = page.getByRole("region", { name: "Coach" });

  // Undo/redo on a real move; the ranked daily counts its undos down.
  await page.getByRole("button", { name: "Show best move" }).click();
  await expect(coach.getByText("Winning line")).toBeVisible();
  await coach.getByRole("button", { name: "Make this move" }).click();
  await expect(page.getByText("Moves 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo · 3" }).click();
  await expect(page.getByText("Moves 0", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo · 2" })).toBeDisabled();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Moves 1", { exact: true })).toBeVisible();

  const won = page.getByText("Won.", { exact: true });
  for (let i = 0; i < 300 && !(await won.isVisible()); i++) {
    const finish = page.getByRole("button", { name: "Auto-finish" });
    if ((await finish.count()) && (await finish.isEnabled())) {
      await finish.click();
      await won.waitFor({ timeout: 15_000 });
      break;
    }
    const ask = page.getByRole("button", { name: "Show best move" });
    if (await ask.isVisible()) await ask.click();
    const make = coach.getByRole("button", { name: "Make this move" });
    await make.click({ timeout: 5_000 }).catch(() => {});
  }
  await expect(page.getByText("Won.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Faster than 40% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
});

test("practice freecell: a fresh verified deal with unlimited undo", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/freecell?practice=1");
  await expect(page.getByText("Practice deal", { exact: true })).toBeVisible({ timeout: 15_000 });
  const coach = page.getByRole("region", { name: "Coach" });
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Show best move" }).click();
    await coach.getByRole("button", { name: "Make this move" }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
  }
  await expect(page.getByText("Moves 0", { exact: true })).toBeVisible();
  // After the free hints, the coach still answers when no rewarded ad is available.
  await expect(coach.getByText("hints used")).toBeVisible();
});
