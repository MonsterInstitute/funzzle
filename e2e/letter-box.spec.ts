import { expect, test } from "@playwright/test";
import { generateDailyLetterBox } from "../lib/games/dailyPuzzles";
import { bestPath } from "../lib/games/letterbox/box";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("letter box: tap a word, reject, delete back, coach ladder, solve in par, recap and share", async ({ page }) => {
  await stubWrites(page, 70);
  await page.goto("/play/letter-box");
  await expect(page.getByRole("heading", { name: "Letter Box", exact: true })).toBeVisible();
  // The daily box is a pure function of the date (a stored row is generated the same way).
  const p = generateDailyLetterBox(today());
  const [a] = p.solution;
  const letter = (ch: string) => page.getByRole("button", { name: new RegExp(`^${ch.toUpperCase()}, (top|right|bottom|left) side`) });

  // Two letters from one side can't follow each other.
  await letter(p.sides[0][0]).click();
  await expect(letter(p.sides[0][1])).toBeDisabled();
  await page.getByRole("button", { name: "Restart", exact: true }).click();

  // Tap the first word of the solution, then delete the carried letter to take it back.
  for (const ch of a) await letter(ch).click();
  await page.getByRole("button", { name: "Enter", exact: true }).click();
  await expect(page.getByLabel("Words played")).toHaveText(a.toUpperCase());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByLabel("Words played")).toHaveText("");
  await page.getByRole("button", { name: "Restart", exact: true }).click();

  // Coach: starting letter → shape → the word, played for you.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await expect(coach).toContainText(/Start with [A-Z]/);
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the word" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  const coachText = (await coach.textContent()) ?? "";
  const shown = /Play ([A-Z]+)/.exec(coachText)?.[1]?.toLowerCase();
  expect(shown).toBeTruthy();
  await coach.getByRole("button", { name: "Play it" }).click();
  await expect(page.getByLabel("Words played")).toHaveText(shown!.toUpperCase());

  // Finish with the keyboard: a shortest path from here, from the page's own word list.
  const rest = bestPath(p, [shown!], 3)!;
  for (const w of rest) {
    await page.keyboard.type(w.slice(1));
    await page.keyboard.press("Enter");
  }

  await expect(page.getByText(`Solved in ${1 + rest.length}.`, { exact: true })).toBeVisible();
  await expect(page.getByText("Beat 70% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();

  const img = await page.request.get(`/api/share-card?g=letter-box&d=${today()}&t=200000&top=30&s=1&h=1&w=2&lv=Par%202&p=0369147a`);
  expect(img.headers()["content-type"]).toBe("image/png");

  await page.reload();
  await expect(page.getByText(`Solved in ${1 + rest.length}.`, { exact: true })).toBeVisible();
});
