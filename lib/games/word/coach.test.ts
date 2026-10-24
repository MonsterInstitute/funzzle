import { describe, expect, it } from "vitest";
import { isValid5 } from "@/lib/games/words/words5";
import { GEO_COUNTRIES } from "./geoData";
import { gridHint, list, OPENERS } from "./coach";
import { findCountry, geoHint, scoreGeo } from "./geo";
import { validateEquation } from "./math";

describe("word coach", () => {
  it("opens with a teaching nudge and the stored opener", () => {
    const h = gridHint({ mode: "classic", answers: ["robin"], guesses: [] })!;
    expect(h.technique).toBe("opening");
    expect(h.direction).toMatch(/five different common letters/);
    expect(h.suggestion).toBe(OPENERS.classic);
    expect(h.specific).toMatch(/try SLATE/);
    expect(h.reveal).toEqual({ board: 0, pos: 0, ch: "r" });
    expect(h.answer).toBe("Spot 1 is R. It’s marked in your next row.");
  });

  it("explains what the guesses rule out, then suggests a strong, valid guess", () => {
    const h = gridHint({ mode: "classic", answers: ["robin"], guesses: ["slate"] })!;
    console.log(h.direction, "|", h.specific);
    expect(h.direction).toMatch(/^Your guesses rule out S, L, A, T and E\. [\d,]+ words still fit\.$/);
    expect(isValid5(h.suggestion!)).toBe(true);
    expect(h.specific).toMatch(new RegExp(`try ${h.suggestion!.toUpperCase()}`));
    expect(h.specific).toMatch(/tests /);
    expect(h.remaining[0]).toBeGreaterThan(1);
  });

  it("describes greens and yellows, and reveals the first unknown spot", () => {
    // ROBIN vs ORBIT: O, R yellow; B, I green; T gray.
    const h = gridHint({ mode: "classic", answers: ["robin"], guesses: ["orbit"] })!;
    console.log(h.direction);
    expect(h.direction).toMatch(/rule out T\./);
    expect(h.direction).toMatch(/Fixed: B in spot 3 and I in spot 4\./);
    expect(h.direction).toMatch(/O is in it but not in spot 1 and R is in it but not in spot 2\./);
    expect(h.reveal).toEqual({ board: 0, pos: 0, ch: "r" });
    // With that letter revealed, the next reveal moves on.
    const h2 = gridHint({ mode: "classic", answers: ["robin"], guesses: ["orbit"], reveals: [h.reveal!] })!;
    expect(h2.reveal!.pos).toBe(1);
  });

  it("closes out without naming the word when one answer is left", () => {
    const h = gridHint({ mode: "classic", answers: ["robin"], guesses: ["slate", "corny", "robed"] })!;
    if (h.remaining[0] === 1) {
      expect(h.technique).toBe("one-left");
      expect(h.suggestion).toBeNull();
      expect(h.specific).not.toMatch(/ROBIN/);
    }
  });

  it("quad focuses the open board closest to solved and notes solved boards", () => {
    const answers = ["robin", "crane", "pluck", "ghost"];
    const h = gridHint({ mode: "quad", answers, guesses: ["crane", "pilot"] })!;
    console.log(h.direction, "|", h.specific);
    expect(h.remaining[1]).toBe(0);
    expect(h.board).not.toBe(1);
    expect(h.direction).toMatch(/^Board \d: Your guesses/);
    expect(h.direction).toMatch(/Board 2 is solved/);
    expect(h.answer).toMatch(/^On board \d, spot \d is [A-Z]\./);
  });

  it("math talks about operators first, digits next", () => {
    const h = gridHint({ mode: "math", answers: ["12+47=59"], guesses: ["46-27=19"] })!;
    console.log(h.direction, "|", h.specific);
    expect(h.direction).toMatch(/The = sign is in spot 6/);
    expect(h.direction).toMatch(/There's no −\./);
    expect(validateEquation(h.suggestion!)).toBeNull();
    expect(h.specific).toMatch(/Digits ruled out: 6\./);
  });

  it("formats lists", () => {
    expect(list(["A"])).toBe("A");
    expect(list(["A", "B"])).toBe("A and B");
    expect(list(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("geo coach", () => {
  const kenya = findCountry("Kenya", GEO_COUNTRIES)!;
  it("continent, then a neighbor, then the first letter", () => {
    const g = scoreGeo(findCountry("Egypt", GEO_COUNTRIES)!, kenya);
    const h = geoHint(kenya, [g], GEO_COUNTRIES);
    expect(h.direction).toMatch(/^It's in Africa\. Your closest guess, Egypt, is [\d,]+ km away: head south from there\.$/);
    expect(h.specific).toMatch(/^It shares a border with [A-Z][a-z]+/);
    expect(h.answer).toBe("Its name starts with K and has 5 letters.");
  });

  it("island countries have no neighbor hint", () => {
    const japan = findCountry("Japan", GEO_COUNTRIES)!;
    expect(geoHint(japan, [], GEO_COUNTRIES).specific).toBe("It has no land borders: it's an island country in Asia.");
  });
});
