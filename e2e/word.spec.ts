import { expect, test } from "@playwright/test";
import { classicAnswer } from "../lib/games/word/words";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

test("daily word: invalid guess, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 58);
  await page.goto("/play/word");
  await expect(page.getByRole("heading", { name: "Funzzle Word", exact: true })).toBeVisible();
  // The daily answer is a pure function of the date (the stored row is generated the same way).
  const answer = classicAnswer(today());
  // The flow below opens with the coach's SLATE; on the (rare) day that's the answer, skip.
  test.skip(answer === "slate", "today's answer is the coach's opener");
  const keyboard = page.getByRole("group", { name: "Keyboard" });
  const guesses = page.getByRole("list", { name: "Guesses" });

  // Not a word: rejected without using a row.
  await page.keyboard.type("zzzzz");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Not in the word list" })).toBeVisible();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");

  // Coach: what the guesses prove → the best next guess (fills the row) → a letter.
  await page.getByRole("button", { name: "Get a hint" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await expect(coach).toContainText("try SLATE");
  await coach.getByRole("button", { name: "Use SLATE" }).click();
  await keyboard.getByRole("button", { name: "Enter" }).click();
  await expect(guesses.getByRole("listitem").first()).toHaveAccessibleName(/^Guess 1: S /);

  // Second hint: the rule-out summary now names the grays.
  await page.getByRole("button", { name: "Get a hint" }).click();
  await expect(coach).toContainText(/still fit|Only one word fits/);
  await coach.getByRole("button", { name: "More help" }).click();
  await coach.getByRole("button", { name: "Show a letter" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await expect(coach).toContainText(/Spot \d is [A-Z]\./);
  await coach.getByRole("button", { name: "Got it" }).click();

  // Solve with the on-screen keyboard.
  for (const ch of answer.toUpperCase()) await keyboard.getByRole("button", { name: new RegExp(`^${ch}(,|$)`) }).click();
  await keyboard.getByRole("button", { name: "Enter" }).click();

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Better than 58% of today’s players")).toBeVisible();
  await expect(page.getByText("Daily Set · 1 of 4")).toBeVisible();
  await expect(page.getByText(/Your key move:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=word&d=${today()}&t=95000&s=1&h=2&lv=Classic&sc=2/6&map=01020-22222`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // The homepage Daily Set card counts it, and a reload brings the recap back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("2/6", { exact: false }).first()).toBeVisible();
});

test("word modes load: quad, geo and math", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/word/quad");
  await expect(page.getByRole("heading", { name: "Word Quad", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Board \d/ })).toHaveCount(4);

  await page.goto("/play/word/math");
  await expect(page.getByRole("heading", { name: "Word Math", exact: true })).toBeVisible();
  await page.keyboard.type("12+46=58");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Guesses" }).getByRole("listitem").first()).toHaveAccessibleName(/^Guess 1: 1 /);

  await page.goto("/play/word/geo");
  await expect(page.getByRole("heading", { name: "Word Geo", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Country" }).fill("Fran");
  await page.getByRole("option", { name: "France" }).getByRole("button").click();
  await expect(page.getByRole("list", { name: "Guesses" }).getByRole("listitem").first()).toHaveAccessibleName(/^Guess 1: France, /);
  await page.getByRole("button", { name: "Get a hint" }).click();
  await expect(page.getByRole("region", { name: "Coach" })).toContainText(/It's in (Africa|Asia|Europe|Oceania|the Americas)\./);
});
