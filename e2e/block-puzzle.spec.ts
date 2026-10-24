import { expect, test } from "@playwright/test";
import { stubWrites } from "./helpers";

test("daily block puzzle: drag a piece, follow the coach, play to the end and see the recap", async ({ page }) => {
  await stubWrites(page, 64, { lo: 0, hi: 2800 });
  await page.goto("/play/block-puzzle");
  await expect(page.getByRole("heading", { name: "Daily Block Puzzle", exact: true })).toBeVisible();
  await expect(page.getByText("Pieces left 75")).toBeVisible();

  // A real drag: piece 1 onto the middle of the empty board.
  const board = page.getByRole("grid", { name: /Block Puzzle board/ });
  const piece = page.getByRole("button", { name: /^Piece 1:/ });
  const from = (await piece.boundingBox())!;
  const to = (await board.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 40, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Pieces left 74")).toBeVisible();

  // The coach's three free hints, then keyboard play (1–3 picks a piece, Enter places it).
  const coach = page.getByRole("region", { name: "Coach" });
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Show best spot" }).click();
    await coach.getByRole("button", { name: "Place it" }).click();
  }
  await expect(page.getByText("Pieces left 71")).toBeVisible();

  const over = page.getByText(/^(Game over\.|All placed\.)$/);
  for (let i = 0; i < 200 && !(await over.isVisible()); i++) {
    if (await page.getByRole("button", { name: "See my score" }).isVisible()) {
      await page.getByRole("button", { name: "See my score" }).click();
      break;
    }
    if (await page.getByRole("heading", { name: "Daily Block Puzzle", exact: true }).isVisible()) {
      await page.keyboard.press(String((i % 3) + 1));
      await page.keyboard.press("Enter");
    }
  }
  await expect(over).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Higher score than 64% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
});
