import { expect, test } from "@playwright/test";
import { stubWrites } from "./helpers";

test("daily solitaire: the coach's best moves win the daily deal", async ({ page }) => {
  await stubWrites(page, 40);
  await page.goto("/play/solitaire");
  await expect(page.getByText("Winnable deal")).toBeVisible();
  const coach = page.getByRole("region", { name: "Coach" });

  // Undo/redo on a real move.
  await page.getByRole("button", { name: "Show best move" }).click();
  await coach.getByRole("button", { name: "Make this move" }).click();
  await expect(page.getByText("Moves 1")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Moves 0")).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Moves 1")).toBeVisible();

  const won = page.getByText("Won.", { exact: true });
  for (let i = 0; i < 600 && !(await won.isVisible()); i++) {
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
