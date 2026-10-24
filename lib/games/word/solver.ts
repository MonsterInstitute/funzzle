/**
 * Elimination solver behind the coach. Candidates are the answers that still
 * fit every scored guess; a guess is rated by how evenly it splits them by
 * the colors it would get back (Shannon entropy, in bits), so the best guess
 * is the one that is expected to leave the fewest candidates. Quad sums the
 * entropy over the boards still open.
 */
import { scoreCode, solvedCode, type Clue, encodeMarks } from "./score";

/** Answers consistent with every clue. */
export function filterCandidates(pool: readonly string[], clues: readonly Clue[]): string[] {
  const codes = clues.map((c) => encodeMarks(c.marks));
  return pool.filter((w) => clues.every((c, i) => scoreCode(c.guess, w) === codes[i]));
}

export interface Split {
  guess: string;
  /** Expected information, summed over boards (bits). */
  bits: number;
  /** Most candidates that could be left on one board, whatever the colors. */
  worst: number;
  /** Distinct color patterns (groups), summed over boards. */
  groups: number;
  /** The guess is itself a possible answer on some open board. */
  candidate: boolean;
}

let hist = new Int32Array(243);

/** How a guess splits each board's candidates. */
export function rateGuess(guess: string, boards: readonly (readonly string[])[]): Split {
  const len = guess.length;
  const size = 3 ** len;
  if (hist.length < size) hist = new Int32Array(size);
  const win = solvedCode(len);
  let bits = 0;
  let worst = 0;
  let groups = 0;
  let candidate = false;
  const touched: number[] = [];
  for (const cands of boards) {
    const n = cands.length;
    if (!n) continue;
    for (let i = 0; i < n; i++) {
      const c = scoreCode(guess, cands[i]);
      if (hist[c] === 0) touched.push(c);
      hist[c]++;
    }
    let sum = 0;
    for (const c of touched) {
      const k = hist[c];
      sum += k * Math.log2(k);
      // Guessing the answer leaves nothing to find on that board.
      if (c !== win && k > worst) worst = k;
      if (c === win) candidate = true;
      hist[c] = 0;
    }
    groups += touched.length;
    bits += Math.log2(n) - sum / n;
    touched.length = 0;
  }
  return { guess, bits, worst, groups, candidate };
}

/** Higher is better: more information; then a possible answer; then a smaller worst case. */
export function better(a: Split, b: Split): boolean {
  const eps = 1e-9;
  if (Math.abs(a.bits - b.bits) > eps) return a.bits > b.bits;
  if (a.candidate !== b.candidate) return a.candidate;
  if (a.worst !== b.worst) return a.worst < b.worst;
  return a.guess < b.guess;
}

/** Deterministic evenly spaced sample of at most `max` items. */
export function spread<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.floor((i * items.length) / max)]);
  return out;
}

/**
 * Probe words from `guesses` that cover the most uncertain letters (those in
 * about half of the candidates) in new spots. Cheap pre-filter so the full
 * entropy rating only runs on a few hundred guesses.
 */
export function probes(guesses: readonly string[], boards: readonly (readonly string[])[], count: number): string[] {
  const all = boards.flat();
  if (!all.length) return [];
  const len = all[0].length;
  const letter = new Map<string, number>();
  const spot = new Map<string, number>();
  for (const w of all) {
    for (const ch of new Set(w)) letter.set(ch, (letter.get(ch) ?? 0) + 1);
    for (let i = 0; i < len; i++) spot.set(`${i}${w[i]}`, (spot.get(`${i}${w[i]}`) ?? 0) + 1);
  }
  const n = all.length;
  const value = (p: number) => Math.min(p, n - p) / n;
  const scored = guesses.map((g) => {
    let s = 0;
    const seen = new Set<string>();
    for (let i = 0; i < len; i++) {
      const ch = g[i];
      if (!seen.has(ch)) s += value(letter.get(ch) ?? 0);
      seen.add(ch);
      s += 0.3 * value(spot.get(`${i}${ch}`) ?? 0);
    }
    return { g, s };
  });
  scored.sort((a, b) => b.s - a.s || (a.g < b.g ? -1 : 1));
  return scored.slice(0, count).map((x) => x.g);
}

export interface BestGuessOptions {
  /** Extra guess words to consider besides the candidates (probes are picked from these). */
  guessWords?: readonly string[];
  /** Only guesses that pass this (hard mode). */
  allowed?: (guess: string) => boolean;
  maxCandidates?: number;
  maxProbes?: number;
}

/** The best next guess for the open boards (each a list of candidates). */
export function bestGuess(boards: readonly (readonly string[])[], opts: BestGuessOptions = {}): Split | null {
  const open = boards.filter((b) => b.length > 0);
  if (!open.length) return null;
  const allowed = opts.allowed ?? (() => true);
  // A board down to one word: solving it now is never worse than a probe.
  const single = open.filter((b) => b.length === 1).map((b) => b[0]).filter(allowed);
  const pool = new Set<string>(single);
  if (!single.length) {
    for (const w of spread(open.flat().filter(allowed), opts.maxCandidates ?? 400)) pool.add(w);
    if (opts.guessWords && open.some((b) => b.length > 2)) {
      const extra = probes(opts.guessWords.filter(allowed), open, opts.maxProbes ?? 150);
      for (const w of extra) pool.add(w);
    }
  }
  let best: Split | null = null;
  for (const g of pool) {
    const s = rateGuess(g, open);
    if (!best || better(s, best)) best = s;
  }
  return best;
}
