import { describe, expect, it } from "vitest";
import { referralSource } from "@/lib/referral";

describe("referralSource", () => {
  it("groups AI assistants as ai:*", () => {
    expect(referralSource("https://chatgpt.com/")).toBe("ai:chatgpt");
    expect(referralSource("https://chat.openai.com/c/1")).toBe("ai:chatgpt");
    expect(referralSource("https://www.perplexity.ai/search?q=x")).toBe("ai:perplexity");
    expect(referralSource("https://claude.ai/chat/1")).toBe("ai:claude");
    expect(referralSource("https://copilot.microsoft.com/")).toBe("ai:copilot");
    expect(referralSource("https://gemini.google.com/app")).toBe("ai:gemini");
  });
  it("classifies search, social, internal, direct and other", () => {
    expect(referralSource("https://www.google.com/")).toBe("search:google");
    expect(referralSource("https://www.google.co.uk/")).toBe("search:google");
    expect(referralSource("https://www.bing.com/search?q=wordle")).toBe("search:bing");
    expect(referralSource("https://old.reddit.com/r/wordle")).toBe("social:reddit");
    expect(referralSource("https://www.funzzle.com/play/sudoku")).toBe("internal");
    expect(referralSource("")).toBe("direct");
    expect(referralSource("not a url")).toBe("other");
    expect(referralSource("https://example.com/")).toBe("other");
  });
  it("doesn't mistake lookalike hosts", () => {
    expect(referralSource("https://notchatgpt.com/")).toBe("other");
    expect(referralSource("https://claude.ai.evil.example/")).toBe("other");
  });
});
