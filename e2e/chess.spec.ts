import { expect, test, type Page } from "@playwright/test";
import { generateDailyChess } from "../lib/games/dailyPuzzles";
import { legalUiMoves, replay } from "../lib/games/chess";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);
const square = (page: Page, name: string) => page.getByRole("gridcell", { name: new RegExp(`^${name},`) });

async function play(page: Page, uci: string) {
  await square(page, uci.slice(0, 2)).click();
  await square(page, uci.slice(2, 4)).click();
  if (uci.length > 4) {
    const names: Record<string, string> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
    await page.getByRole("button", { name: `Promote to ${names[uci[4]]}` }).click();
  }
}

test("daily chess puzzle: wrong move, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 70);
  await page.goto("/play/chess");
  await expect(page.getByRole("heading", { name: "Daily Chess Puzzle", exact: true })).toBeVisible();
  // The daily puzzle is a pure function of the date (the stored row is generated the same way).
  const { puzzle } = generateDailyChess(today());
  const coach = page.getByRole("region", { name: "Coach" });

  // A legal move that isn't the solution is a mistake, and the board goes back.
  const start = replay(puzzle.fen, []);
  const wrong = legalUiMoves(start).find((m) => m.uci !== puzzle.solution[0] && !(puzzle.kind === "mate" && puzzle.solution.length === 1 && m.san.endsWith("#")))!;
  await play(page, wrong.uci);
  await expect(page.getByText("Mistakes 1")).toBeVisible();
  await expect(coach).toContainText("doesn’t work");

  // Coach: which piece → the idea → the move, then play it from the coach.
  await coach.getByRole("button", { name: "Get a hint" }).click();
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the move" }).click();
  await expect(coach).toContainText(`Play ${puzzle.san[0]}`);
  await coach.getByRole("button", { name: "Play it" }).click();

  // The rest of the line on the board; the opponent's forced replies come by themselves.
  for (let i = 2; i < puzzle.solution.length; i += 2) {
    await expect(page.getByText("Correct. Keep going.")).toBeVisible();
    await play(page, puzzle.solution[i]);
  }

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 70% of today’s players")).toBeVisible();
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=chess&d=${today()}&t=40000&top=30&s=1&m=1&h=1&lv=Easy`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: today's result is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});

test("play the computer: move, engine reply, undo, resign, recap", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/chess?practice=ai");
  await expect(page.getByRole("heading", { name: "Chess", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^1 · Beginner/ }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Start game" }).click();

  await expect(page.getByText("Your move.")).toBeVisible();
  await play(page, "e2e4");
  // The engine (in a Web Worker) answers; then it's our move again.
  await expect(page.getByText("Your move.")).toBeVisible({ timeout: 15_000 });
  await expect(square(page, "e4")).toHaveAccessibleName(/white pawn/);

  // Coach hint: the engine's best move with a reason.
  await page.getByRole("button", { name: "Show best move" }).click();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("Play ", { timeout: 15_000 });
  await coach.getByRole("button", { name: "Why this one?" }).click();

  // Undo takes back the reply and our move.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("No moves yet.")).toBeVisible();
  await expect(square(page, "e2")).toHaveAccessibleName(/white pawn/);

  // Drag a piece: g1 to f3.
  await page.getByRole("grid").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  const from = await square(page, "g1").boundingBox();
  const to = await square(page, "f3").boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(square(page, "f3")).toHaveAccessibleName(/white knight/);
  await expect(page.getByText("Your move.")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: "Sure?" }).click();
  await expect(page.getByText("Lost.")).toBeVisible();
  await expect(page.getByText(/You resigned/)).toBeVisible();
});
