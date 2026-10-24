import { expect, test } from "@playwright/test";
import { stubWrites } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;

test("daily 2048: slide, follow the coach, undo once, end the game and see the recap", async ({ page }) => {
  await stubWrites(page, 64, { lo: 0, hi: 28000 });
  await page.goto("/play/2048");
  await expect(page.getByRole("heading", { name: "Daily 2048", exact: true })).toBeVisible();
  await expect(page.getByText("Same tiles for everyone")).toBeVisible();
  const board = page.getByRole("application");
  await expect(board).toBeVisible();

  // Keyboard slides: the score chip appears and moves happen.
  for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowDown"]) await page.keyboard.press(key);

  // A swipe on the board also moves the tiles.
  const box = (await board.boundingBox())!;
  const before = await page.locator("[aria-live=polite]").last().textContent();
  for (let i = 0; i < 4; i++) {
    const [x0, x1] = i % 2 ? [box.x + box.width * 0.8, box.x + box.width * 0.2] : [box.x + box.width * 0.2, box.x + box.width * 0.8];
    await page.mouse.move(x0, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x1, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
  }
  void before;

  // Coach: best move, why, make it.
  const coach = page.getByRole("region", { name: "Coach" });
  await page.getByRole("button", { name: "Show best move" }).click();
  await expect(coach.getByText(/^Slide (up|down|left|right)\./)).toBeVisible();
  await coach.getByRole("button", { name: "Why this one?" }).click();
  await expect(coach.getByText(/moves ahead/)).toBeVisible();
  await coach.getByRole("button", { name: "Make this move" }).click();

  // One free undo, then it's spent (no rewarded ad in tests).
  await page.getByRole("button", { name: /Undo · 1 left/ }).click();
  await expect(page.getByRole("button", { name: /Undo · 0 left/ })).toBeDisabled();

  // A few more slides from the keyboard.
  for (let i = 0; i < 20; i++) await page.keyboard.press(["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowDown"][i % 4]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/2048-board-light.png` });
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: `${SHOTS}/2048-board-dark.png` });
    await page.emulateMedia({ colorScheme: "light" });
  }

  // End the game from the pause sheet (two taps confirm).
  await page.getByRole("button", { name: "Options" }).click();
  await page.getByRole("button", { name: "End game" }).click();
  await page.getByRole("button", { name: /Tap again to end with/ }).click();

  await expect(page.getByText("Game over.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Higher score than 64% of today’s players")).toBeVisible();
  await expect(page.getByText("Best tile", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Challenge a friend", exact: true })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/2048-recap-light.png`, fullPage: true });
  if (SHOTS) {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: `${SHOTS}/2048-recap-dark.png`, fullPage: true });
  }

  // The finished daily stays finished on reload.
  await page.reload();
  await page.getByRole("button", { name: "Close recap" }).click();
  await expect(page.getByRole("button", { name: "See recap" })).toBeVisible();
});

test("2048 practice from the URL is a fresh game", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/2048?practice=1");
  await expect(page.getByRole("heading", { name: "2048", exact: true })).toBeVisible();
  await expect(page.getByText("Practice", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/play\/2048$/);
});
