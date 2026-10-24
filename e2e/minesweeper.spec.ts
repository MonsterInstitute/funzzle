import { expect, test } from "@playwright/test";
import { generateDailyMinesweeper } from "../lib/games/dailyPuzzles";
import { neighbors } from "../lib/games/minesweeper";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily minesweeper: flag mode, undo flag, keyboard flag, coach ladder, clear, recap and share", async ({ page }) => {
  await stubWrites(page, 73);
  await page.goto("/play/minesweeper");
  await expect(page.getByRole("heading", { name: "Daily Minesweeper", exact: true })).toBeVisible();
  // The daily board is a pure function of the date (the stored row is generated the same way).
  const board = generateDailyMinesweeper(today());
  const { width, height, mines, firstClick } = board;
  const cell = (i: number) => page.getByRole("gridcell").nth(i);
  await expect(page.getByRole("gridcell")).toHaveCount(width * height);
  await expect(cell(firstClick)).toHaveAccessibleName(/empty/);
  await expect(page.getByText("40 mines left")).toBeVisible();

  // A mine on the edge of the opening: flag it in flag mode, then undo.
  const label = async (i: number) => (await cell(i).getAttribute("aria-label")) ?? "";
  let edgeMine = -1;
  for (let i = 0; i < mines.length && edgeMine < 0; i++) {
    if (!mines[i]) continue;
    for (const j of neighbors(width, height, i)) {
      if (!mines[j] && !(await label(j)).includes("hidden")) {
        edgeMine = i;
        break;
      }
    }
  }
  expect(edgeMine).toBeGreaterThanOrEqual(0);
  await page.getByRole("button", { name: "Flag mode", exact: true }).click();
  await cell(edgeMine).click();
  await expect(cell(edgeMine)).toHaveAccessibleName(/flagged/);
  await expect(page.getByText("39 mines left")).toBeVisible();
  await page.getByRole("button", { name: "Undo flag" }).click();
  await expect(cell(edgeMine)).toHaveAccessibleName(/hidden/);
  await expect(page.getByText("40 mines left")).toBeVisible();
  await page.getByRole("button", { name: "Flag mode", exact: true }).click();

  // Keyboard: F flags the focused cell, Ctrl+Z takes the last flag back.
  await cell(edgeMine).focus();
  await page.keyboard.press("f");
  await expect(cell(edgeMine)).toHaveAccessibleName(/flagged/);
  await page.keyboard.press("Control+z");
  await expect(cell(edgeMine)).toHaveAccessibleName(/hidden/);

  // Coach: where to look → why → the answer, which the coach plays for you.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the answer" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();

  // Open every safe cell that's still hidden (opening a blank spreads, so many are done already).
  for (let i = 0; i < mines.length; i++) {
    if (mines[i]) continue;
    if (await page.getByText("Cleared.").isVisible()) break;
    if ((await label(i)).includes("hidden")) await cell(i).click();
  }

  await expect(page.getByText("Cleared.")).toBeVisible();
  await expect(page.getByText("Faster than 73% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=minesweeper&d=${today()}&t=200000&top=27&s=1&m=0&h=1&lv=Intermediate`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Cleared.")).toBeVisible();
});
