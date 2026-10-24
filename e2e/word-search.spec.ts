import { expect, test, type Page } from "@playwright/test";
import { wordCells, type WordSearchPuzzle } from "../lib/games/wordsearch";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);
const shots = process.env.SHOTS_DIR;

async function drag(page: Page, from: number, to: number) {
  const a = await page.getByRole("gridcell").nth(from).boundingBox();
  const b = await page.getByRole("gridcell").nth(to).boundingBox();
  if (!a || !b) throw new Error("cell not visible");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2 + a.width / 2, (a.y + b.y) / 2 + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
}

test("daily word search: drag to find, tap-tap, coach ladder, keyboard, recap and share", async ({ page }) => {
  await stubWrites(page, 58);
  await page.goto("/play/word-search");
  await expect(page.getByRole("heading", { name: "Daily Word Search", exact: true })).toBeVisible();
  // The page's puzzle: the stored row, or the bank grid for today (same as the archive API).
  const p = (await (await page.request.get(`/api/daily-puzzle?game=word-search&date=${today()}`)).json()) as WordSearchPuzzle;
  const words = p.words.map((w) => wordCells(p.size, w));
  await expect(page.getByText(`Found 0 / ${p.words.length}`)).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/word-search-start.png` });

  // A drag that spells nothing is not a find.
  await drag(page, words[0][0], words[0][1]);
  await expect(page.getByText(`Found 0 / ${p.words.length}`)).toBeVisible();

  // Drag the first word, backward (last letter to first) for the second.
  await drag(page, words[0][0], words[0].at(-1)!);
  await expect(page.getByText(`Found 1 / ${p.words.length}`)).toBeVisible();
  await drag(page, words[1].at(-1)!, words[1][0]);
  await expect(page.getByText(`Found 2 / ${p.words.length}`)).toBeVisible();

  // Tap the first letter, then the last.
  await page.getByRole("gridcell").nth(words[2][0]).click();
  await page.getByRole("gridcell").nth(words[2].at(-1)!).click();
  await expect(page.getByText(`Found 3 / ${p.words.length}`)).toBeVisible();

  // Coach: where it starts → which way → circled.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  if (shots) await page.screenshot({ path: `${shots}/word-search-coach.png` });
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the word" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await expect(page.getByText(`Found 4 / ${p.words.length}`)).toBeVisible();
  await coach.getByRole("button", { name: "Got it" }).click();

  // Keyboard: Enter on the first letter, arrows to the last, Enter again (for an across word, if there is one left).
  const across = p.words.findIndex((w, i) => w.dir === 0 && i > 2);
  const isFound = async (i: number) => (await page.getByRole("listitem").filter({ hasText: new RegExp(`^${p.words[i].word}$`, "i") }).getAttribute("aria-label"))?.endsWith("found");
  if (across >= 0 && !(await isFound(across))) {
    const cells = words[across];
    await page.getByRole("gridcell").nth(cells[0]).click();
    await page.getByRole("gridcell").nth(cells[0]).click(); // second tap clears the anchor
    await page.getByRole("grid").focus();
    await page.keyboard.press("Enter");
    for (let k = 1; k < cells.length; k++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listitem").filter({ hasText: new RegExp(`^${p.words[across].word}$`, "i") })).toHaveAttribute("aria-label", /found/);
  }

  // Drag the rest.
  for (let i = 0; i < p.words.length; i++) {
    if (await isFound(i)) continue;
    await drag(page, words[i][0], words[i].at(-1)!);
  }

  await expect(page.getByText("All found.")).toBeVisible();
  await expect(page.getByText("Faster than 58% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/word-search-recap.png`, fullPage: true });
  const img = await page.request.get(`/api/share-card?g=word-search&d=${today()}&t=200000&top=30&s=1&m=0&h=1&lv=12x12&wl=5,7,6,9,4`);
  expect(img.headers()["content-type"]).toBe("image/png");
  if (shots) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${shots}/word-search-card.png`, await img.body());
  }

  // Reload: the finished grid is remembered.
  await page.reload();
  await expect(page.getByText("All found.")).toBeVisible();
});
