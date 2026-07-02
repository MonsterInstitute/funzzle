import { seedFromDate } from "./connections";

/** Pool of valid 8-character equations for the daily puzzle. */
export const NERDLE_POOL: string[] = [
  "12+47=59",
  "98-53=45",
  "7*8+4=60",
  "6*7-2=40",
  "63/9=6+1",
  "48/6=4+4",
  "5*5+9=34",
  "11+22=33",
  "64/8=1+7",
  "3*9+7=34",
  "81/9=3*3",
  "7+8+9=24",
  "50-27=23",
  "4*6+1=25",
  "9+9+9=27",
  "72/8=3+6",
  "6+7*3=27",
  "18+45=63",
  "5*9-5=40",
  "36/4=3*3",
  "8*8-4=60",
  "12*4=6*8",
  "15+15=30",
  "90/6=5*3",
  "4+5+6=15",
];

export const NERDLE_LEN = 8;

/** Evaluate a non-negative integer arithmetic expression with + - * / precedence. */
export function evalExpr(expr: string): number {
  const tokens = expr.match(/\d+|[+\-*/]/g);
  if (!tokens || tokens.length % 2 === 0) return NaN;
  const terms: number[] = [Number(tokens[0])];
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const n = Number(tokens[i + 1]);
    if (Number.isNaN(n)) return NaN;
    if (op === "*") terms.push(terms.pop()! * n);
    else if (op === "/") {
      const d = terms.pop()!;
      if (n === 0 || d % n !== 0) return NaN;
      terms.push(d / n);
    } else if (op === "+") terms.push(n);
    else if (op === "-") terms.push(-n);
    else return NaN;
  }
  return terms.reduce((a, b) => a + b, 0);
}

/** Validate a Nerdle guess. Returns an error string, or null if valid. */
export function validateEquation(guess: string): string | null {
  if (guess.length !== NERDLE_LEN) return `Must be ${NERDLE_LEN} characters`;
  if (!/^[0-9+\-*/=]+$/.test(guess)) return "Invalid characters";
  const eqParts = guess.split("=");
  if (eqParts.length !== 2) return "Needs exactly one =";
  const [lhs, rhs] = eqParts;
  if (!lhs || !rhs) return "Both sides required";
  const left = evalExpr(lhs);
  const right = evalExpr(rhs);
  if (Number.isNaN(left) || Number.isNaN(right)) return "Not a valid equation";
  if (left !== right) return "Left side ≠ right side";
  return null;
}

export type CharState = "correct" | "present" | "absent" | "empty";

/** Wordle-style scoring across the 8 characters, handling duplicates. */
export function scoreEquation(guess: string, answer: string): CharState[] {
  const result: CharState[] = Array(NERDLE_LEN).fill("absent");
  const counts: Record<string, number> = {};
  for (const c of answer) counts[c] = (counts[c] ?? 0) + 1;
  for (let i = 0; i < NERDLE_LEN; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      counts[guess[i]]--;
    }
  }
  for (let i = 0; i < NERDLE_LEN; i++) {
    if (result[i] === "correct") continue;
    const c = guess[i];
    if (counts[c] > 0) {
      result[i] = "present";
      counts[c]--;
    }
  }
  return result;
}

export function equationForDate(iso: string): string {
  const seed = seedFromDate(iso);
  return NERDLE_POOL[seed % NERDLE_POOL.length];
}
