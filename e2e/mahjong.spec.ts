import { expect, test, type Page } from "@playwright/test";
import { applyMatch, bestMove, generateDeal, isStuck, isWon, matchingPairs, newGame, shuffleRemaining, type LayoutId, type State } from "../lib/games/mahjong";
import { stubWrites } from "./helpers";

/** The board as the page shows it: tile per position, and which are gone. */
async function readBoard(page: Page, layout: LayoutId): Promise<State> {
  const tiles = await page.locator("[data-pos]").evaluateAll((els) =>
    els.map((e) => ({ p: Number(e.getAttribute("data-pos")), id: e.getAttribute("data-tile")!, gone: (e as HTMLButtonElement).disabled }))
  );
  tiles.sort((a, b) => a.p - b.p);
  return { ...newGame(layout, tiles.map((t) => t.id)), removed: tiles.map((t) => t.gone) };
}

const tile = (page: Page, p: number) => page.locator(`[data-pos="${p}"]`);

test("mahjong practice: show a match, undo, blocked tiles, and follow the coach to a clear", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/mahjong?practice=quick");
  await expect(page.getByRole("heading", { name: "Mahjong", exact: true })).toBeVisible();
  await expect(page.getByText("Quick · 72 tiles · Practice")).toBeVisible();
  await expect(page.getByText("Solvable deal")).toBeVisible();
  const coach = page.getByRole("region", { name: "Coach" });

  // "Show a match" highlights a pair and says why; tapping the two tiles matches them.
  await page.getByRole("button", { name: "Show a match" }).click();
  await expect(coach.getByRole("button", { name: "Match these" })).toBeVisible();
  await expect(coach).toContainText(/Match|Take the pair/);
  const hinted = page.locator("[data-hint]");
  await expect(hinted).toHaveCount(2);
  const pair = await hinted.evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-pos"))));
  await tile(page, pair[0]).click();
  await expect(tile(page, pair[0])).toHaveAttribute("aria-pressed", "true");
  await tile(page, pair[1]).click();
  await expect(page.getByText("Tiles 70", { exact: true })).toBeVisible();

  // Unlimited undo, and redo.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Tiles 72", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByText("Tiles 70", { exact: true })).toBeVisible();

  // A blocked tile explains why it can't be picked.
  const blocked = page.locator("[data-pos]:not([data-free]):not([disabled])").first();
  await blocked.click({ force: true });
  await expect(coach).toContainText(/covered|both sides/);
  await coach.getByRole("button", { name: "Close coach" }).click();

  // Clear the board: the in-game hints while they last, then the same coach run here.
  const cleared = page.getByText("Cleared.", { exact: true });
  for (let i = 0; i < 80 && !(await cleared.isVisible()); i++) {
    const ask = page.getByRole("button", { name: "Show a match" });
    if (await ask.isVisible()) {
      await ask.click();
      await coach.getByRole("button", { name: "Match these" }).click();
      continue;
    }
    const state = await readBoard(page, "quick");
    if (isWon(state)) break;
    const h = bestMove(state);
    expect(h).not.toBeNull();
    await tile(page, h!.pair[0]).click();
    await tile(page, h!.pair[1]).click();
  }
  await expect(cleared).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mahjong practice", exact: true })).toBeVisible();
  await expect(page.getByText("Practice puzzle")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy result" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deal a practice game" })).toBeVisible();
});

test("daily mahjong: the Turtle fits a phone, and a coach match can be undone", async ({ page }) => {
  await stubWrites(page);
  await page.goto("/play/mahjong");
  await expect(page.getByRole("heading", { name: "Daily Mahjong", exact: true })).toBeVisible();
  await expect(page.getByText("Turtle · 144 tiles", { exact: true })).toBeVisible();
  const board = page.getByRole("group", { name: "Mahjong board, Turtle" });
  const box = (await board.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  await page.getByRole("button", { name: "Show a match" }).click();
  await expect(page.locator("[data-hint]")).toHaveCount(2);
  await page.getByRole("button", { name: "Match these" }).click();
  await expect(page.getByText("Tiles 142", { exact: true })).toBeVisible();
  await expect(page.getByText("2 hints left")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Tiles 144", { exact: true })).toBeVisible();

  // Zoom enlarges the board past the screen's width; the page scrolls it sideways.
  await page.getByRole("button", { name: /Zoom/ }).click();
  expect((await board.boundingBox())!.width).toBeGreaterThan(box.width);
});

test("mahjong stuck: the first practice shuffle is free and deals a clearable position", async ({ page }) => {
  await stubWrites(page);
  // A practice game played into a dead end (no free pairs), saved as the player would leave it.
  let start: State | null = null;
  let stuck: State | null = null;
  for (let i = 0; i < 50 && !stuck; i++) {
    const seed = `mahjong-practice:e2e-stuck-${i}`;
    start = generateDeal("quick", seed).state;
    let s = start;
    while (!isWon(s) && !isStuck(s)) s = applyMatch(s, matchingPairs(s).at(-1)!);
    if (isStuck(s) && shuffleRemaining(s, "check")) stuck = s;
  }
  expect(stuck).not.toBeNull();
  await page.addInitScript(
    ([saved]) => {
      localStorage.setItem("fz:mahjong:practice", saved);
      localStorage.setItem("fz:mahjong:mode", JSON.stringify("practice"));
    },
    [JSON.stringify({ key: "e2e-stuck", mode: "practice", seed: "e2e-stuck", verified: true, start, state: stuck, elapsed: 30_000, hints: 0 })]
  );
  await page.goto("/play/mahjong");
  await expect(page.getByRole("heading", { name: "Mahjong", exact: true })).toBeVisible();
  await expect(page.getByText("Open pairs 0", { exact: true })).toBeVisible();
  const coach = page.getByRole("region", { name: "Coach" });
  await expect(coach).toContainText("No free pairs left");
  await coach.getByRole("button", { name: "Shuffle (free)" }).click();
  await expect(page.getByText("Open pairs 0", { exact: true })).toBeHidden();
  await expect(page.getByText("3 hints left")).toBeVisible();
  // Undo takes the shuffle back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Open pairs 0", { exact: true })).toBeVisible();
});
