import { expect, test, type Page } from "@playwright/test";
import { stubWrites } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

interface Puzzle {
  title: string;
  grid: string;
  words: { word: string; path: number[]; span: boolean }[];
  bonus: string[];
}

/** One way to trace `word` through the grid, avoiding `blocked` cells. */
function trace(grid: string, word: string, blocked: Set<number>): number[] | null {
  const W = word.toUpperCase();
  const path: number[] = [];
  const go = (i: number, k: number): boolean => {
    if (grid[i] !== W[k] || path.includes(i) || blocked.has(i)) return false;
    path.push(i);
    if (k === W.length - 1) return true;
    const r = Math.floor(i / 6);
    const c = i % 6;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < 8 && cc >= 0 && cc < 6 && go(rr * 6 + cc, k + 1)) return true;
      }
    }
    path.pop();
    return false;
  };
  for (let i = 0; i < 48; i++) if (go(i, 0)) return path;
  return null;
}

const cell = (page: Page, i: number) => page.getByRole("gridcell").nth(i);

async function drag(page: Page, path: number[]) {
  // Mouse input only reaches what's on screen: bring the whole board into view.
  await page.getByRole("grid").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const center = async (i: number) => {
    const b = (await cell(page, i).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const start = await center(path[0]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const i of path.slice(1)) {
    const p = await center(i);
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
}

async function tapWord(page: Page, path: number[]) {
  for (const i of path) await cell(page, i).click();
  await cell(page, path[path.length - 1]).click();
}

test("daily word hunt: drag, tap, bonus words, coach ladder, solve, recap and share", async ({ page }) => {
  await stubWrites(page, 58);
  // Today's puzzle, exactly as the page gets it (stored row or the bank fallback).
  const res = await page.request.get(`/api/daily-puzzle?game=word-hunt&date=${today()}`);
  expect(res.ok()).toBe(true);
  const { puzzle } = (await res.json()) as { puzzle: Puzzle };

  await page.goto("/play/word-hunt");
  await expect(page.getByRole("heading", { name: "Daily Word Hunt", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: puzzle.title, exact: true })).toBeVisible();
  // The board on the page is that puzzle.
  const letters = await page.getByRole("gridcell").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? "")[0]).join(""));
  expect(letters).toBe(puzzle.grid);

  const themeIdx = puzzle.words.map((_, i) => i).filter((i) => !puzzle.words[i].span);
  const spanIdx = puzzle.words.findIndex((w) => w.span);

  // Three bonus words fill the hint meter.
  const bonus: number[][] = [];
  for (const b of puzzle.bonus) {
    const path = trace(puzzle.grid, b, new Set());
    if (path) bonus.push(path);
    if (bonus.length === 3) break;
  }
  expect(bonus).toHaveLength(3);
  for (const path of bonus) await drag(page, path);
  await expect(page.getByText("1 earned hint ready")).toBeVisible();

  // Earned hint → the coach's ladder: area, first letter, the word.
  const coach = page.getByRole("region", { name: "Coach" });
  await coach.getByRole("button", { name: "Use an earned hint" }).click();
  await expect(coach).toContainText("Hint 1 of 3");
  await coach.getByRole("button", { name: "More help" }).click();
  await expect(coach).toContainText("Hint 2 of 3");
  await coach.getByRole("button", { name: "Show the word" }).click();
  await expect(coach).toContainText("Hint 3 of 3");
  await coach.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText(`1 of ${puzzle.words.length} theme words`)).toBeVisible();

  // A free coach hint now counts against the three.
  await coach.getByRole("button", { name: "Get a hint" }).click();
  await coach.getByRole("button", { name: "Close coach" }).click();
  await expect(coach).toContainText("2 hints left");

  // Which word did the earned hint reveal? Its cells are now part of it.
  const labels = await page.getByRole("gridcell").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  const done = (i: number) => puzzle.words[i].path.every((c) => labels[c].includes(`part of ${puzzle.words[i].word}`));
  const todo = [...themeIdx.filter((i) => !done(i)), spanIdx];

  // First by dragging, the next with the keyboard, the rest by tapping.
  const [first, second, ...rest] = todo;
  await drag(page, puzzle.words[first].path);
  await expect(page.getByText(`${puzzle.words[first].word} · ${puzzle.words[first].span ? "span word!" : "theme word"}`)).toBeVisible();
  for (const c of puzzle.words[second].path) {
    await cell(page, c).focus();
    await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Enter");
  for (const i of rest) await tapWord(page, puzzle.words[i].path);

  await expect(page.getByText("Solved.")).toBeVisible();
  await expect(page.getByText("Faster than 58% of today’s players")).toBeVisible();
  const found = page.getByRole("region", { name: "Words found" });
  for (const w of puzzle.words) await expect(found).toContainText(w.word);
  await expect(found).toContainText("Span word");
  await expect(found).toContainText("Coach");
  await expect(page.getByRole("button", { name: "Share card" })).toBeVisible();
  const img = await page.request.get(`/api/share-card?g=word-hunt&d=${today()}&t=200000&top=40&s=1&m=0&h=1&bw=3&lv=Daily&map=rtttsttt`);
  expect(img.headers()["content-type"]).toBe("image/png");

  // Reload: the finished hunt is remembered and the recap comes back.
  await page.reload();
  await expect(page.getByText("Solved.")).toBeVisible();
});
