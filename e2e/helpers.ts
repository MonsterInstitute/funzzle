import type { Page } from "@playwright/test";

/** Stub the endpoints that write to the production database. */
export async function stubWrites(page: Page, percentile = 64) {
  const buckets = [1, 3, 6, 9, 12, 14, 12, 9, 7, 5, 3, 2, 1, 1];
  await page.route("**/api/results", (route) =>
    route.fulfill({ json: { count: 85, buckets, lo: 60000, hi: 1500000, percentile } })
  );
  await page.route("**/api/events", (route) => route.fulfill({ status: 204, body: "" }));
}
