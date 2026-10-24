import { expect, test, type Page } from "@playwright/test";
import { stubWrites } from "./helpers";

const COLS = 6; // the daily is 24 pieces, 6 × 4

const trayPieces = (page: Page) => page.locator('[aria-label="Piece tray"] button[data-id]');
const slot = (page: Page, id: number) =>
  page.getByRole("gridcell", { name: new RegExp(`^Row ${Math.floor(id / COLS) + 1}, column ${(id % COLS) + 1}(,|$)`) });

test("daily jigsaw: coach, drag and tap-to-place finish the puzzle", async ({ page }) => {
  await stubWrites(page, 36);
  await page.goto("/play/jigsaw");
  await expect(page.getByRole("heading", { name: "Daily Jigsaw", exact: true })).toBeVisible();
  await expect(page.getByText("Placed 0 / 24")).toBeVisible();
  const coach = page.getByRole("region", { name: "Coach" });

  // The coach starts with a corner and places it.
  await coach.getByRole("button", { name: "Show a piece" }).click();
  await expect(coach).toContainText("corner");
  await coach.getByRole("button", { name: "Place it" }).click();
  await expect(page.getByText("Placed 1 / 24")).toBeVisible();

  // Edge filter shows only border pieces.
  await page.getByRole("button", { name: "Edges only" }).click();
  await expect(trayPieces(page).first()).toHaveAttribute("aria-label", /corner|edge/);
  await page.getByRole("button", { name: "Edges only" }).click();

  // A real drag from the tray onto the piece's spot snaps it in.
  const first = trayPieces(page).first();
  await first.scrollIntoViewIfNeeded();
  const id = Number(await first.getAttribute("data-id"));
  const from = (await first.boundingBox())!;
  const to = (await slot(page, id).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + from.width / 2 + ((to.x + to.width / 2 - from.x - from.width / 2) * i) / 8, from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * i) / 8);
  }
  await page.mouse.up();
  await expect(page.getByText("Placed 2 / 24")).toBeVisible();

  // A wrong spot is refused with a gentle note.
  const next = trayPieces(page).first();
  const nextId = Number(await next.getAttribute("data-id"));
  await next.click();
  const wrong = [...Array(24).keys()].find((i) => i !== nextId && !(i === id))!;
  await slot(page, wrong).click();
  await expect(coach).toContainText(/doesn’t go there|already filled/);

  // Tap a piece, then its spot, for the rest.
  const done = page.getByText("Done.", { exact: true });
  for (let i = 0; i < 30 && !(await done.isVisible()); i++) {
    const piece = trayPieces(page).first();
    if (!(await piece.count())) break;
    const pid = Number(await piece.getAttribute("data-id"));
    if ((await piece.getAttribute("aria-pressed")) !== "true") await piece.click();
    await slot(page, pid).click();
  }
  await expect(done).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Faster than 36% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
});
