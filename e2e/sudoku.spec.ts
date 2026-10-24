import { expect, test } from "@playwright/test";
import { generateDailySudoku } from "../lib/games/dailyPuzzles";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily sudoku: mistake, undo, notes, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 73);
  await page.goto("/play/sudoku");
  await expect(page.getByRole("heading", { name: "Daily Sudoku" })).toBeVisible();
  // The daily grid is a pure function of the date (the stored row is generated the same way).
  const { puzzle, solution } = generateDailySudoku(today());
  const empties = puzzle.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const cell = (i: number) => page.getByRole("gridcell").nth(i);

  // A wrong digit counts as a mistake; undo removes it.
  const first = empties[0];
  await cell(first).click();
  const wrong = solution[first] === 9 ? 1 : solution[first] + 1;
  await page.keyboard.press(String(wrong));
  await expect(page.getByText("Mistakes 1 / 3")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cell(first)).toHaveAccessibleName(/empty/);

  // Notes mode pencils candidates instead of entering.
  await page.keyboard.press("n");
  await page.keyboard.press("4");
  await expect(cell(first)).toHaveAccessibleName(/empty/);
  await page.keyboard.press("n");

  // Coach: nudge → details → answer places a correct digit.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the answer" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();

  // Fill the rest with the keyboard.
  for (const i of empties) {
    if (!(await cell(i).getAttribute("aria-label"))?.includes("empty")) continue;
    await cell(i).click();
    await page.keyboard.press(String(solution[i]));
  }

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 73% of today’s players")).toBeVisible();
  await expect(page.getByText("Daily Set · 1 of 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(
    `/api/share-card?g=sudoku&d=${today()}&t=400000&top=27&s=1&m=0&h=1&lv=Hard&map=${"0123".repeat(20)}0`
  );
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});
