/**
 * Scoring for every grid mode of Funzzle Word (classic, quad, math): each
 * tile is right spot, wrong spot or absent, with duplicate letters handled
 * the usual way (exact matches first, then wrong-spot marks while the answer
 * still has unmatched copies of that letter).
 */

/** 0 = absent, 1 = in the answer but elsewhere, 2 = right spot. */
export type Mark = 0 | 1 | 2;

/** Marks for one guess against one answer. */
export function score(guess: string, answer: string): Mark[] {
  const n = answer.length;
  const out = new Array<Mark>(n).fill(0);
  const left = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) out[i] = 2;
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < n; i++) {
    if (out[i] === 2) continue;
    const k = left.get(guess[i]) ?? 0;
    if (k > 0) {
      out[i] = 1;
      left.set(guess[i], k - 1);
    }
  }
  return out;
}

// Scratch counts indexed by char code; reset after each call.
const counts = new Int16Array(128);

/**
 * The same marks packed into one base-3 number (tile 0 is the lowest digit).
 * Allocation-free: the solver calls this millions of times.
 */
export function scoreCode(guess: string, answer: string): number {
  const n = answer.length;
  let greens = 0;
  for (let i = 0; i < n; i++) {
    const a = answer.charCodeAt(i);
    if (guess.charCodeAt(i) === a) greens |= 1 << i;
    else counts[a]++;
  }
  let code = 0;
  let p = 1;
  for (let i = 0; i < n; i++, p *= 3) {
    if (greens & (1 << i)) {
      code += 2 * p;
      continue;
    }
    const g = guess.charCodeAt(i);
    if (counts[g] > 0) {
      code += p;
      counts[g]--;
    }
  }
  for (let i = 0; i < n; i++) counts[answer.charCodeAt(i)] = 0;
  return code;
}

export function encodeMarks(marks: readonly Mark[]): number {
  let code = 0;
  for (let i = marks.length - 1; i >= 0; i--) code = code * 3 + marks[i];
  return code;
}

export function decodeMarks(code: number, n: number): Mark[] {
  const out: Mark[] = [];
  for (let i = 0; i < n; i++) {
    out.push((code % 3) as Mark);
    code = Math.floor(code / 3);
  }
  return out;
}

/** Code of an all-green row of length n. */
export const solvedCode = (n: number) => 3 ** n - 1;

export interface Clue {
  guess: string;
  marks: Mark[];
}

/**
 * What a set of scored guesses proves about the answer: letters fixed in a
 * spot, letters known to be in it (with the spots they're not in), the
 * minimum and exact counts of each letter, and letters ruled out entirely.
 */
export interface Knowledge {
  length: number;
  /** Spot → letter, from right-spot marks (and coach reveals). */
  fixed: (string | null)[];
  /** Letter → spots it is known not to be in. */
  notAt: Map<string, Set<number>>;
  /** Letter → at least this many copies. */
  min: Map<string, number>;
  /** Letter → exactly this many copies (an absent mark caps the count). */
  exact: Map<string, number>;
  /** Letters with no copies at all, in the order they were ruled out. */
  absent: string[];
}

export function knowledge(clues: readonly Clue[], length: number, reveals: readonly { pos: number; ch: string }[] = []): Knowledge {
  const k: Knowledge = { length, fixed: new Array(length).fill(null), notAt: new Map(), min: new Map(), exact: new Map(), absent: [] };
  const notAt = (ch: string, i: number) => {
    if (!k.notAt.has(ch)) k.notAt.set(ch, new Set());
    k.notAt.get(ch)!.add(i);
  };
  for (const { guess, marks } of clues) {
    const seen = new Map<string, number>();
    const capped = new Set<string>();
    for (let i = 0; i < length; i++) {
      const ch = guess[i];
      if (marks[i] === 2) k.fixed[i] = ch;
      if (marks[i] === 1) notAt(ch, i);
      if (marks[i] === 0) {
        capped.add(ch);
        notAt(ch, i);
      } else {
        seen.set(ch, (seen.get(ch) ?? 0) + 1);
      }
    }
    for (const [ch, n] of seen) k.min.set(ch, Math.max(k.min.get(ch) ?? 0, n));
    for (const ch of capped) {
      const n = seen.get(ch) ?? 0;
      k.exact.set(ch, n);
      if (n === 0 && !k.absent.includes(ch)) k.absent.push(ch);
    }
  }
  for (const { pos, ch } of reveals) {
    k.fixed[pos] = ch;
  }
  // A fixed letter counts toward the minimum too (reveals, or greens of one letter).
  const fixedCounts = new Map<string, number>();
  for (const ch of k.fixed) if (ch) fixedCounts.set(ch, (fixedCounts.get(ch) ?? 0) + 1);
  for (const [ch, n] of fixedCounts) k.min.set(ch, Math.max(k.min.get(ch) ?? 0, n));
  k.absent = k.absent.filter((ch) => !(k.min.get(ch) ?? 0));
  return k;
}

/** Whether `word` could still be the answer given what's known. */
export function fits(word: string, k: Knowledge): boolean {
  if (word.length !== k.length) return false;
  for (let i = 0; i < k.length; i++) {
    const f = k.fixed[i];
    if (f && word[i] !== f) return false;
    const banned = k.notAt.get(word[i]);
    if (!f && banned?.has(i)) return false;
  }
  const have = new Map<string, number>();
  for (const ch of word) have.set(ch, (have.get(ch) ?? 0) + 1);
  for (const [ch, n] of k.min) if ((have.get(ch) ?? 0) < n) return false;
  for (const [ch, n] of k.exact) if ((have.get(ch) ?? 0) !== Math.max(n, k.min.get(ch) ?? 0)) return false;
  return true;
}

/**
 * Hard mode: every right-spot letter must stay in its spot and every
 * wrong-spot letter must be reused. Returns why a guess breaks the rule, or
 * null when it's allowed.
 */
export function hardModeViolation(guess: string, clues: readonly Clue[]): string | null {
  const ord = (i: number) => ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"][i] ?? `${i + 1}th`;
  for (const { guess: g, marks } of clues) {
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] === 2 && guess[i] !== g[i]) return `${ord(i)} spot must be ${g[i].toUpperCase()}`;
    }
    const need = new Map<string, number>();
    for (let i = 0; i < marks.length; i++) if (marks[i] > 0) need.set(g[i], (need.get(g[i]) ?? 0) + 1);
    for (const [ch, n] of need) {
      const have = [...guess].filter((c) => c === ch).length;
      if (have < n) return `Guess must contain ${ch.toUpperCase()}`;
    }
  }
  return null;
}
