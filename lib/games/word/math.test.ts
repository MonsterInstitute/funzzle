import { describe, expect, it } from "vitest";
import { evalExpr, mathAnswers, practiceEquation, validateEquation } from "./math";

describe("equations", () => {
  it("evaluates with operator precedence and exact division", () => {
    expect(evalExpr("2+3*4")).toBe(14);
    expect(evalExpr("20-6/3")).toBe(18);
    expect(evalExpr("8/4*3")).toBe(6);
    expect(evalExpr("10-2-3")).toBe(5);
    expect(evalExpr("7/2")).toBeNaN();
    expect(evalExpr("5/0")).toBeNaN();
    expect(evalExpr("-5+2")).toBeNaN();
    expect(evalExpr("5++2")).toBeNaN();
  });

  it("validates guesses with a reason", () => {
    expect(validateEquation("12+47=59")).toBeNull();
    expect(validateEquation("63/9=6+1")).toBeNull(); // an expression on the right is fine as a guess
    expect(validateEquation("12+47=60")).toBe("The left side is 59, not 60");
    expect(validateEquation("12+47=5")).toBe("Must be 8 characters");
    expect(validateEquation("1234=1234")).toBe("Must be 8 characters");
    expect(validateEquation("12345678")).toBe("Needs exactly one =");
    expect(validateEquation("1+2=3=33")).toBe("Needs exactly one =");
    expect(validateEquation("01+47=48")).toBe("No leading zeros");
    expect(validateEquation("1234=123")).toBe("Needs at least one operator");
    expect(validateEquation("=12+4716")).toBe("Needs a number on both sides");
    expect(validateEquation("12/5+3=5")).toBe("That isn't a valid calculation");
  });

  it("accepts every equation of the original pool", () => {
    for (const eq of ["12+47=59", "98-53=45", "7*8+4=60", "6*7-2=40", "48/6=4+4", "12*4=6*8", "90/6=5*3"]) {
      expect(validateEquation(eq)).toBeNull();
    }
  });

  it("enumerates a large, valid, tidy answer pool", () => {
    const all = mathAnswers();
    expect(all.length).toBeGreaterThan(10_000);
    expect(new Set(all).size).toBe(all.length);
    for (const eq of all) {
      expect(eq).toHaveLength(8);
      expect(validateEquation(eq)).toBeNull();
      const [lhs, rhs] = eq.split("=");
      expect(rhs).toMatch(/^[1-9]\d*$/); // the right side is one positive number
      expect(lhs).not.toMatch(/(^|[^\d])0/); // no zero operands or leading zeros
      expect(lhs).not.toMatch(/[*/]1(?!\d)/); // no ×1 or ÷1
      expect(lhs).not.toMatch(/(^|[+\-*/])1\*/); // no 1×
    }
    for (const eq of ["12+47=59", "98-53=45", "7*8+4=60", "9+9+9=27", "72/8=9", "5*5+3=28"].filter((e) => e.length === 8)) {
      expect(all).toContain(eq);
    }
    expect(all).not.toContain("48/6=4+4");
    expect(practiceEquation("seed")).toBe(practiceEquation("seed"));
  });
});
