/**
 * Spelling Hive rules, scoring and ranks. Pure and browser-safe: the puzzle
 * ships its own word lists (see generate.ts, which is server-only).
 *
 * Rules: words of 4+ letters made only from the seven hive letters, always
 * using the center letter; letters can repeat. 4-letter words score 1 point,
 * longer words 1 point per letter, and a pangram (all seven letters) scores 7
 * extra.
 *
 * Two word lists ship with each puzzle:
 *   answers — everyday words (the lexicon's "common" tier). They score, count
 *             toward the rank and make up the maximum score.
 *   bonus   — rarer dictionary words (the "valid" tier minus "common"). They
 *             are accepted and listed as bonus words but score no points, so
 *             a player is never told a real word is "not a word", while the
 *             ranks stay reachable with everyday vocabulary.
 */

export interface HivePuzzle {
  /** The center letter, lowercase. */
  center: string;
  /** The six outer letters, lowercase, in the generator's order. */
  outer: string;
  /** Scoring words, sorted alphabetically. */
  answers: string[];
  /** Accepted for no points, sorted alphabetically. */
  bonus: string[];
  /** Answers that use all seven letters. */
  pangrams: string[];
  maxScore: number;
}

export const MIN_LENGTH = 4;
export const PANGRAM_BONUS = 7;

export function letterSet(p: Pick<HivePuzzle, "center" | "outer">): Set<string> {
  return new Set((p.center + p.outer).split(""));
}

export function isPangram(word: string, letters: Set<string>): boolean {
  const seen = new Set(word);
  for (const l of letters) if (!seen.has(l)) return false;
  return true;
}

export function wordScore(word: string, letters: Set<string>): number {
  if (word.length < MIN_LENGTH) return 0;
  return (word.length === MIN_LENGTH ? 1 : word.length) + (isPangram(word, letters) ? PANGRAM_BONUS : 0);
}

export function maxScoreOf(answers: string[], letters: Set<string>): number {
  return answers.reduce((n, w) => n + wordScore(w, letters), 0);
}

/** Ranks by share of the maximum score. The top rank needs every answer. */
export const RANKS = [
  { name: "Beginner", pct: 0 },
  { name: "Good Start", pct: 2 },
  { name: "Moving Up", pct: 5 },
  { name: "Good", pct: 8 },
  { name: "Solid", pct: 15 },
  { name: "Nice", pct: 25 },
  { name: "Great", pct: 40 },
  { name: "Amazing", pct: 50 },
  { name: "Genius", pct: 70 },
  { name: "Hive Master", pct: 100 },
] as const;

export type RankName = (typeof RANKS)[number]["name"];
export const GREAT = RANKS.findIndex((r) => r.name === "Great");
export const GENIUS = RANKS.findIndex((r) => r.name === "Genius");
export const TOP = RANKS.length - 1;

/** Points needed for each rank on this puzzle. */
export function rankThresholds(maxScore: number): number[] {
  return RANKS.map((r) => (r.pct === 100 ? maxScore : Math.round((r.pct / 100) * maxScore)));
}

export function rankIndex(score: number, maxScore: number): number {
  const t = rankThresholds(maxScore);
  let i = 0;
  for (let k = 0; k < t.length; k++) if (score >= t[k]) i = k;
  return i;
}

export type WordCheck =
  | { ok: true; kind: "answer"; points: number; pangram: boolean }
  | { ok: true; kind: "bonus" }
  | { ok: false; reason: "short" | "center" | "letters" | "unknown" | "found" };

export const REJECT_MESSAGE: Record<Extract<WordCheck, { ok: false }>["reason"], string> = {
  short: "Too short: 4 letters or more",
  center: "Use the center letter",
  letters: "Only the hive’s letters",
  unknown: "Not in the word list",
  found: "Already found",
};

export function checkWord(p: HivePuzzle, found: Iterable<string>, raw: string): WordCheck {
  const word = raw.toLowerCase();
  const letters = letterSet(p);
  if (word.length < MIN_LENGTH) return { ok: false, reason: "short" };
  for (const ch of word) if (!letters.has(ch)) return { ok: false, reason: "letters" };
  if (!word.includes(p.center)) return { ok: false, reason: "center" };
  if (new Set(found).has(word)) return { ok: false, reason: "found" };
  if (binaryHas(p.answers, word)) return { ok: true, kind: "answer", points: wordScore(word, letters), pangram: isPangram(word, letters) };
  if (binaryHas(p.bonus, word)) return { ok: true, kind: "bonus" };
  return { ok: false, reason: "unknown" };
}

function binaryHas(sorted: string[], w: string): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] === w) return true;
    if (sorted[mid] < w) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

export function scoreOf(found: string[], p: HivePuzzle): number {
  const letters = letterSet(p);
  const answers = new Set(p.answers);
  return found.reduce((n, w) => n + (answers.has(w) ? wordScore(w, letters) : 0), 0);
}

/**
 * The hints grid: answers left to find by first letter × length (lengths are
 * the columns), plus the two-letter starts list. Free to look at; it never
 * names a word.
 */
export interface HintGrid {
  lengths: number[];
  rows: { letter: string; counts: number[]; total: number }[];
  totals: number[];
  twoLetter: { prefix: string; left: number }[];
}

export function hintGrid(p: HivePuzzle, found: Iterable<string>): HintGrid {
  const have = new Set(found);
  const left = p.answers.filter((w) => !have.has(w));
  const lengths = [...new Set(p.answers.map((w) => w.length))].sort((a, b) => a - b);
  const letters = [...new Set(p.answers.map((w) => w[0]))].sort();
  const rows = letters.map((letter) => {
    const counts = lengths.map((len) => left.filter((w) => w[0] === letter && w.length === len).length);
    return { letter, counts, total: counts.reduce((a, b) => a + b, 0) };
  });
  const totals = lengths.map((_, i) => rows.reduce((n, r) => n + r.counts[i], 0));
  const prefixes = [...new Set(p.answers.map((w) => w.slice(0, 2)))].sort();
  const twoLetter = prefixes.map((prefix) => ({ prefix, left: left.filter((w) => w.startsWith(prefix)).length }));
  return { lengths, rows, totals, twoLetter };
}
