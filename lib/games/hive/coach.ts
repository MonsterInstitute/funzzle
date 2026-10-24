/**
 * Spelling Hive coach: a three-rung ladder toward one word the player hasn't
 * found. Rung 1 names a two-letter start and how many words are left there,
 * rung 2 shows a definition-free pattern (first and last letters, blanks
 * between), rung 3 reveals the word.
 */
import { isPangram, letterSet, type HivePuzzle } from "./hive";

export interface HiveHint {
  word: string;
  pangram: boolean;
  /** Rung 1: where to look. */
  nudge: string;
  /** Rung 2: the word's shape, e.g. "T _ _ _ N". */
  pattern: string;
  patternText: string;
  /** Rung 3. */
  answer: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "T _ _ _ N": first and last letters with a blank per hidden letter. */
export function wordPattern(word: string): string {
  const w = word.toUpperCase();
  if (w.length <= 2) return w.split("").join(" ");
  return [w[0], ...Array.from({ length: w.length - 2 }, () => "_"), w[w.length - 1]].join(" ");
}

/**
 * The word to coach toward: a pangram while none is found (the biggest
 * payoff), otherwise a word from the two-letter start with the most words
 * left, shortest first. Deterministic for a given puzzle and found list.
 */
export function pickHintWord(p: HivePuzzle, found: Iterable<string>): string | null {
  const have = new Set(found);
  const left = p.answers.filter((w) => !have.has(w));
  if (!left.length) return null;
  const pangramsLeft = p.pangrams.filter((w) => !have.has(w));
  if (pangramsLeft.length && !p.pangrams.some((w) => have.has(w))) {
    return [...pangramsLeft].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
  }
  const byPrefix = new Map<string, string[]>();
  for (const w of left) byPrefix.set(w.slice(0, 2), [...(byPrefix.get(w.slice(0, 2)) ?? []), w]);
  const [, words] = [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0];
  return [...words].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
}

export function hiveHint(p: HivePuzzle, found: Iterable<string>): HiveHint | null {
  const have = new Set(found);
  const word = pickHintWord(p, have);
  if (!word) return null;
  const letters = letterSet(p);
  const pangram = isPangram(word, letters);
  const prefix = word.slice(0, 2).toUpperCase();
  const leftHere = p.answers.filter((w) => !have.has(w) && w.startsWith(word.slice(0, 2))).length;
  const nudge = pangram
    ? `There’s a pangram starting with ${prefix}: it uses all seven letters.`
    : `There ${leftHere === 1 ? "is" : "are"} ${plural(leftHere, "word")} starting with ${prefix} you haven’t found yet.`;
  const pattern = wordPattern(word);
  return {
    word,
    pangram,
    nudge,
    pattern,
    patternText: `${plural(word.length, "letter")}, starts with ${word[0].toUpperCase()} and ends with ${word[word.length - 1].toUpperCase()}.`,
    answer: `The word is ${word.toUpperCase()}${pangram ? ", a pangram" : ""}.`,
  };
}

/** Endings and starts worth checking, for the recap's "next skill". */
const PATTERNS: { label: string; test: (w: string) => boolean; tip: string }[] = [
  { label: "-ING", test: (w) => w.endsWith("ing"), tip: "When the hive has I, N and G, try adding -ING to every verb you find." },
  { label: "-ED", test: (w) => w.endsWith("ed"), tip: "With E and D in the hive, most verbs you find also work with -ED." },
  { label: "-ER", test: (w) => w.endsWith("er"), tip: "E and R together: try -ER on verbs (a person who does it) and adjectives." },
  { label: "-LY", test: (w) => w.endsWith("ly"), tip: "L and Y together: turn adjectives into adverbs with -LY." },
  { label: "-TION", test: (w) => w.endsWith("tion"), tip: "T, I, O and N together often hide long -TION words worth many points." },
  { label: "RE-", test: (w) => w.startsWith("re") && w.length >= 6, tip: "R and E together: try RE- in front of verbs you’ve already found." },
  { label: "UN-", test: (w) => w.startsWith("un") && w.length >= 6, tip: "U and N together: try UN- in front of adjectives." },
  { label: "doubled letters", test: (w) => /(.)\1/.test(w), tip: "Letters can repeat: try doubling consonants, as in ‘llama’ or ‘coffee’." },
];

/** The most-missed word pattern among `missed`, if any pattern covers 2+. */
export function missedPattern(missed: string[]): { label: string; count: number; tip: string } | null {
  let best: { label: string; count: number; tip: string } | null = null;
  for (const p of PATTERNS) {
    const count = missed.filter(p.test).length;
    if (count >= 2 && (!best || count > best.count)) best = { label: p.label, count, tip: p.tip };
  }
  return best;
}
