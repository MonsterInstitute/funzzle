import { expect, test } from "@playwright/test";
import { applyMove, dailyDeal, movableRun, type State } from "../lib/games/spider";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily spider: the coach, then the winning line by keyboard, win the 1-suit deal", async ({ page }) => {
  test.setTimeout(300_000);
  await stubWrites(page, 40);
  await page.goto("/play/spider-solitaire");
  await expect(page.getByRole("heading", { name: "Daily Spider", exact: true })).toBeVisible();
  await expect(page.getByText("1 suit", { exact: true })).toBeVisible();
  await expect(page.getByText("Winnable deal", { exact: true })).toBeVisible();
  // The daily deal is a pure function of the date (the stored row is generated the same way).
  const { state: start, solution } = dailyDeal(today(), 1);
  const coach = page.getByRole("region", { name: "Coach" });

  // The three free hints follow the server's winning line.
  for (let i = 0; i < 3; i++) {
    await coach.getByRole("button", { name: "Show best move", exact: true }).click();
    await expect(coach.getByText("Winning line", { exact: true })).toBeVisible();
    await coach.getByRole("button", { name: "Make this move", exact: true }).click();
    await expect(page.getByText(`Moves ${i + 1}`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Hint · 0 left", exact: true })).toBeDisabled();

  // Undo/redo on a real move.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Moves 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByText("Moves 3", { exact: true })).toBeVisible();

  // The rest of the line through the keyboard controls: Enter on a column picks
  // up its whole run, ArrowDown puts cards back, Enter on another column drops it.
  let state: State = start;
  for (const m of solution.slice(0, 3)) state = applyMove(state, m);
  for (const [i, m] of solution.slice(3).entries()) {
    if (m.kind === "deal") {
      await page.keyboard.press("d");
    } else {
      await page.getByRole("button", { name: new RegExp(`^Column ${m.from + 1}:`) }).focus();
      await page.keyboard.press("Enter");
      for (let k = movableRun(state.tableau[m.from]); k > m.count; k--) await page.keyboard.press("ArrowDown");
      await page.getByRole("button", { name: new RegExp(`^Column ${m.to + 1}:`) }).focus();
      await page.keyboard.press("Enter");
    }
    state = applyMove(state, m);
    if (i % 20 === 0 && i + 4 < solution.length) await expect(page.getByText(`Moves ${i + 4}`, { exact: true })).toBeVisible();
  }

  await expect(page.getByText("Won.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Faster than 40% of today’s players", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result", exact: true })).toBeVisible();
});
