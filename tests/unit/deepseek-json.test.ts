import { describe, expect, it } from "vitest";
import { parseJsonObject } from "@/lib/deepseek";

describe("parseJsonObject", () => {
  it("reads a complete object followed by runaway padding", () => {
    expect(parseJsonObject(`{"groups":[{"title":"a}b \\"q\\""}]}` + "\n".repeat(500))).toEqual({ groups: [{ title: 'a}b "q"' }] });
    expect(parseJsonObject('Sure: {"a":1} {"b":2}')).toEqual({ a: 1 });
  });
  it("returns undefined for a truncated or missing object", () => {
    expect(parseJsonObject('{"groups":[{"title":"x"')).toBeUndefined();
    expect(parseJsonObject("no json")).toBeUndefined();
  });
});
