import { describe, expect, it } from "vitest";
import { TODAY_PATHS } from "@/lib/revalidation";
import { ALL_VARIANTS, variantPath } from "@/lib/seo/variants";

describe("variant pages", () => {
  it("have unique paths, titles and descriptions", () => {
    for (const key of ["slug", "title", "description", "summary"] as const) {
      const values = ALL_VARIANTS.map((v) => (key === "slug" ? variantPath(v) : v[key]));
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("fit search result snippets", () => {
    for (const v of ALL_VARIANTS) {
      // The layout appends " | Funzzle" (10 chars) to the title.
      expect(v.title.length + 10, v.title).toBeLessThanOrEqual(75);
      expect(v.description.length, v.description).toBeGreaterThanOrEqual(120);
      expect(v.description.length, v.description).toBeLessThanOrEqual(200);
      expect(v.qa.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("are refreshed at the day change", () => {
    for (const v of ALL_VARIANTS) expect(TODAY_PATHS).toContain(variantPath(v));
  });
});
