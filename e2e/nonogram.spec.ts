import { expect, test } from "@playwright/test";
import { generateDailyNonogram } from "../lib/games/dailyPuzzles";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily nonogram: mistake, undo, drag, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 73);
  await page.goto("/play/nonogram");
  await expect(page.getByRole("heading", { name: "Daily Nonogram", exact: true })).toBeVisible();
  // The daily puzzle is a pure function of the date (the stored row is generated the same way).
  const { solution, name } = generateDailyNonogram(today());
  const n = 10;
  const cell = (i: number) => page.getByRole("gridcell").nth(i);

  // Filling a cell that should be empty is a mistake; undo clears it.
  const empty = solution.indexOf(0);
  await cell(empty).click();
  await expect(page.getByText("Mistakes 1", { exact: true })).toBeVisible();
  await expect(cell(empty)).toHaveAccessibleName(/filled, wrong/);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cell(empty)).toHaveAccessibleName(/blank/);

  // Cross mode marks a cell as crossed off.
  await page.getByRole("button", { name: "Cross", exact: true }).click();
  await cell(empty).click();
  await expect(cell(empty)).toHaveAccessibleName(/crossed off/);
  await page.getByRole("button", { name: "Fill", exact: true }).click();

  // Drag to paint a run of filled cells in one stroke.
  let runStart = -1;
  let runEnd = -1;
  for (let i = 0; i < n * n && runStart < 0; i++) {
    if (solution[i] && i % n < n - 1 && solution[i + 1]) {
      runStart = i;
      runEnd = i;
      while (runEnd % n < n - 1 && solution[runEnd + 1]) runEnd++;
    }
  }
  const a = (await cell(runStart).boundingBox())!;
  const b = (await cell(runEnd).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  for (let i = runStart; i <= runEnd; i++) await expect(cell(i)).toHaveAccessibleName(/: filled$/);

  // Coach: which line → which rule → which cells.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await expect(coach).toContainText(/Look at (row|column) \d+/);
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the answer" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();

  // Fill the rest by tapping.
  for (let i = 0; i < n * n; i++) {
    if (!solution[i]) continue;
    if ((await cell(i).getAttribute("aria-label"))?.endsWith(": filled")) continue;
    await cell(i).click();
  }

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 73% of today’s players")).toBeVisible();
  await expect(page.getByText(name ? `You painted ${name}.` : "You uncovered a pattern.")).toBeVisible();
  await expect(page.getByRole("img", { name: "The finished picture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=nonogram&d=${today()}&t=200000&top=27&s=1&m=0&h=1&lv=10x10`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});

test("nonogram practice sizes load from the URL", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/nonogram?practice=5");
  await expect(page.getByRole("heading", { name: "Nonogram", exact: true })).toBeVisible();
  await expect(page.getByText("Practice · 5×5")).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(25);
});
