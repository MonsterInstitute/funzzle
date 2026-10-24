import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": path.dirname(fileURLToPath(import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    // Solver/generator tests run a few seconds locally; CI runners are slower.
    testTimeout: 30_000,
  },
});
