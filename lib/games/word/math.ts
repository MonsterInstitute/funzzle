/**
 * Funzzle Word Math: guess an 8-character equation (digits and + - * / =).
 * Evaluation and validation carry over the rules of the original equation
 * game Funzzle used to ship: normal operator precedence, whole numbers only, and
 * every division must come out exact.
 *
 * Answers are enumerated, not hand-picked: every "a op b = c" or
 * "a op b op c = d" that fills 8 characters, with no zero operands, no
 * multiplying or dividing by 1, no leading zeros and a positive result.
 */
import { createRng } from "@/lib/games/kit/rng";
import { dayIndex, scheduledIndex } from "./schedule";

export const EQ_LENGTH = 8;
export const MATH_ROWS = 6;
export const OPERATORS = ["+", "-", "*", "/"] as const;
export const MATH_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "+", "-", "*", "/", "="] as const;

/** Value of a whole-number expression with + - * / precedence, or NaN. */
export function evalExpr(expr: string): number {
  const tokens = expr.match(/\d+|[+\-*/]/g);
  if (!tokens || tokens.join("") !== expr || tokens.length % 2 === 0) return NaN;
  const terms: number[] = [];
  let pending = Number(tokens[0]);
  let sign = 1;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (!/^\d+$/.test(tokens[i + 1])) return NaN;
    if (op === "*") pending *= n;
    else if (op === "/") {
      if (n === 0 || pending % n !== 0) return NaN;
      pending /= n;
    } else {
      terms.push(sign * pending);
      sign = op === "+" ? 1 : -1;
      pending = n;
    }
  }
  terms.push(sign * pending);
  return terms.reduce((a, b) => a + b, 0);
}

const hasLeadingZero = (side: string) => /(^|[+\-*/])0\d/.test(side);

/** Why a guess isn't a valid equation, or null when it is. */
export function validateEquation(guess: string): string | null {
  if (guess.length !== EQ_LENGTH) return `Must be ${EQ_LENGTH} characters`;
  if (!/^[0-9+\-*/=]+$/.test(guess)) return "Only digits, + - * / and =";
  const parts = guess.split("=");
  if (parts.length !== 2) return "Needs exactly one =";
  const [lhs, rhs] = parts;
  if (!lhs || !rhs) return "Needs a number on both sides";
  if (!/[+\-*/]/.test(lhs) && !/[+\-*/]/.test(rhs)) return "Needs at least one operator";
  if (hasLeadingZero(lhs) || hasLeadingZero(rhs)) return "No leading zeros";
  const left = evalExpr(lhs);
  const right = evalExpr(rhs);
  if (Number.isNaN(left) || Number.isNaN(right)) return "That isn't a valid calculation";
  if (left !== right) return `The left side is ${left}, not ${right}`;
  return null;
}

let pool: string[] | null = null;

/** a op b with exact division, or NaN. */
function apply(a: number, op: string, b: number): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  return a % b === 0 ? a / b : NaN;
}

const mul = (op: string) => op === "*" || op === "/";

/** The b for which `u op b` can land in [lo, hi] (a superset for "/", checked exactly later). */
function operandRange(u: number, op: string, lo: number, hi: number): [number, number] {
  if (op === "+") return [lo - u, hi - u];
  if (op === "-") return [u - hi, u - lo];
  if (u <= 0) return [1, 0];
  if (op === "*") return [Math.ceil(lo / u), Math.floor(hi / u)];
  return [Math.ceil(u / hi), Math.floor(u / lo)];
}

/**
 * Every answer equation, sorted. Built once on first use, with plain
 * arithmetic (no string parsing) so it stays fast in the browser.
 */
export function mathAnswers(): string[] {
  if (pool) return pool;
  const out: string[] = [];
  const range = (len: number): [number, number] => [len === 1 ? 1 : 10 ** (len - 1), 10 ** len - 1];
  // lhs is 4–6 characters; the result takes exactly the rest.
  for (let L = 4; L <= 6; L++) {
    const [lo, hi] = range(EQ_LENGTH - 1 - L);
    const ok = (v: number) => Number.isInteger(v) && v >= lo && v <= hi;
    for (let la = 1; la <= L - 2; la++) {
      const [a0, a1] = range(la);
      const [b0, b1] = range(L - 1 - la);
      for (let a = a0; a <= a1; a++)
        for (const op of OPERATORS) {
          const [x, y] = operandRange(a, op, lo, hi);
          for (let b = Math.max(b0, x); b <= Math.min(b1, y); b++) {
            if (mul(op) && (b === 1 || (op === "*" && a === 1))) continue;
            const v = apply(a, op, b);
            if (ok(v)) out.push(`${a}${op}${b}=${v}`);
          }
        }
    }
    for (let la = 1; la <= L - 4; la++) {
      for (let lb = 1; lb <= L - 3 - la; lb++) {
        const [a0, a1] = range(la);
        const [b0, b1] = range(lb);
        const [c0, c1] = range(L - 2 - la - lb);
        for (let a = a0; a <= a1; a++)
          for (const o1 of OPERATORS)
            for (let b = b0; b <= b1; b++) {
              if (mul(o1) && (b === 1 || (o1 === "*" && a === 1))) continue;
              const left = apply(a, o1, b);
              for (const o2 of OPERATORS) {
                // Precedence: a + b * c groups the right pair; everything else runs left to right.
                const grouped = mul(o2) && !mul(o1);
                let x: number;
                let y: number;
                if (grouped) {
                  const [p, q] = operandRange(a, o1, lo, hi); // range of b o2 c
                  [x, y] = operandRange(b, o2, Math.max(1, p), q);
                } else {
                  if (Number.isNaN(left)) continue;
                  [x, y] = operandRange(left, o2, lo, hi);
                }
                for (let c = Math.max(c0, x); c <= Math.min(c1, y); c++) {
                  if (mul(o2) && (c === 1 || (o2 === "*" && b === 1 && !mul(o1)))) continue;
                  const v = grouped ? apply(a, o1, apply(b, o2, c)) : apply(left, o2, c);
                  if (ok(v)) out.push(`${a}${o1}${b}${o2}${c}=${v}`);
                }
              }
            }
      }
    }
  }
  pool = [...new Set(out)].sort();
  return pool;
}

/** Today's equation, the same for everyone; no repeat within a year. */
export function mathAnswer(date: string): string {
  const all = mathAnswers();
  return all[scheduledIndex("word:math", all.length, dayIndex(date), 366)];
}

export function practiceEquation(seed: string): string {
  const all = mathAnswers();
  return all[createRng(seed).int(all.length)];
}
