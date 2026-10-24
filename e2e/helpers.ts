import type { Page } from "@playwright/test";

/**
 * Stub the endpoints that write to the production database. `range` sets the
 * histogram's lo/hi (ms, or points for score games).
 */
export async function stubWrites(page: Page, percentile = 64, range: { lo: number; hi: number } = { lo: 60000, hi: 1500000 }) {
  const buckets = [1, 3, 6, 9, 12, 14, 12, 9, 7, 5, 3, 2, 1, 1];
  await page.route("**/api/results", (route) =>
    route.fulfill({ json: { count: 85, buckets, ...range, percentile } })
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
}
