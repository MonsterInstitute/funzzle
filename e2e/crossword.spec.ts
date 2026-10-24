import { expect, test } from "@playwright/test";
import type { CrosswordPuzzle } from "../lib/games/crossword";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);
const shots = process.env.SHOTS_DIR;

test("daily crossword: type, check, pencil, coach ladder, reveal, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 41);
  await page.goto("/play/crossword");
  await expect(page.getByRole("heading", { name: "Daily Crossword", exact: true })).toBeVisible();
  // The page's puzzle: the stored row, or today's bank puzzle (same as the archive API).
  const p = (await (await page.request.get(`/api/daily-puzzle?game=crossword&date=${today()}`)).json()) as CrosswordPuzzle;
  const cells = page.getByRole("grid").getByRole("gridcell");
  const white = [...p.grid].map((ch, i) => (ch === "#" ? -1 : i)).filter((i) => i >= 0);
  const first = white[0];
  if (shots) await page.screenshot({ path: `${shots}/crossword-start.png` });

  // A wrong letter, then Check square marks it wrong.
  await cells.nth(first).click();
  const wrong = p.grid[first] === "z" ? "q" : "z";
  await page.keyboard.press(wrong);
  await expect(cells.nth(first)).toHaveAccessibleName(new RegExp(`: ${wrong.toUpperCase()}`));
  await cells.nth(first).click(); // typing moved on to the next square
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByRole("button", { name: "check square" }).click();
  await expect(cells.nth(first)).toHaveAccessibleName(/marked wrong/);

  // Pencil mode writes a pencilled letter.
  await cells.nth(first).click();
  await page.getByRole("button", { name: /^Pencil/ }).first().click();
  await page.keyboard.press(p.grid[first]);
  await expect(cells.nth(first)).toHaveAccessibleName(/pencil/);
  await page.getByRole("button", { name: /^Pencil/ }).first().click();

  // Coach: easiest clue → pattern with a crossing → one letter.
  await page.getByRole("button", { name: /^Hint/ }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await expect(coach).toContainText("letters:");
  if (shots) await page.screenshot({ path: `${shots}/crossword-coach.png` });
  await coach.getByRole("button", { name: "Show a letter" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("gridcell", { name: /revealed/ })).toHaveCount(1);

  // Fill the rest by tapping each square and typing.
  for (const i of white) {
    const name = (await cells.nth(i).getAttribute("aria-label")) ?? "";
    if (name.includes(`: ${p.grid[i].toUpperCase()}`) && !name.includes("pencil") && !name.includes("wrong")) continue;
    await cells.nth(i).click();
    await page.keyboard.press(p.grid[i]);
  }

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 41% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/crossword-recap.png`, fullPage: true });
  const map = [...p.grid].map((ch) => (ch === "#" ? "0" : "1")).join("");
  const img = await page.request.get(`/api/share-card?g=crossword&d=${today()}&t=600000&top=40&s=1&m=1&h=2&lv=${p.size}x${p.size}&cw=${map}`);
  expect(img.headers()["content-type"]).toBe("image/png");
  if (shots) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${shots}/crossword-card.png`, await img.body());
  }

  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});
