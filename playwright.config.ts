import { defineConfig, devices } from "@playwright/test";

/**
 * Mobile E2E for the core game flows. Runs against BASE_URL (default: a local
 * `next dev` on :3123). Result/analytics requests are stubbed in the tests so
 * a run never writes fake players into the real percentiles.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3123",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /home\.spec/ },
  ],
});
